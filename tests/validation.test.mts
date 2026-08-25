import assert from "node:assert/strict";
import test from "node:test";
import { listQuerySchema, submissionSchema } from "../lib/validation.ts";

const baseSubmission = {
  providerName: "Example",
  officialUrl: "https://example.com",
  benefits: [{ type: "token" as const, amount: 1000 }],
  requiresInvite: false,
  requiresNewAccount: false,
  isLongTerm: false,
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: "2026-09-01T00:00:00.000Z",
  turnstileToken: "test-token",
};

test("official URL rejects IP addresses", () => {
  const result = submissionSchema.safeParse({
    ...baseSubmission,
    officialUrl: "https://127.0.0.1/offer",
  });
  assert.equal(result.success, false);
});

test("new account requirement is explicit", () => {
  const missingRequirement: Partial<typeof baseSubmission> = { ...baseSubmission };
  delete missingRequirement.requiresNewAccount;
  assert.equal(submissionSchema.safeParse(missingRequirement).success, false);
});

test("token plans and other benefits use their own fields", () => {
  const tokenPlan = submissionSchema.safeParse({
    ...baseSubmission,
    benefits: [{ type: "token-plan", planName: "Starter", validDays: 30 }],
  });
  const other = submissionSchema.safeParse({
    ...baseSubmission,
    benefits: [{ type: "other", description: "仅限教育用户" }],
  });
  const invalidTokenPlan = submissionSchema.safeParse({
    ...baseSubmission,
    benefits: [{ type: "token-plan", planName: "", validDays: 0 }],
  });
  assert.equal(tokenPlan.success, true);
  assert.equal(other.success, true);
  assert.equal(invalidTokenPlan.success, false);
});

test("measured benefit units are normalized and restricted", () => {
  const token = submissionSchema.safeParse(baseSubmission);
  const dollars = submissionSchema.safeParse({
    ...baseSubmission,
    benefits: [{ type: "voucher", amount: 5, unit: "USD" }],
  });
  const invalidVoucher = submissionSchema.safeParse({
    ...baseSubmission,
    benefits: [{ type: "voucher", amount: 5, unit: "EUR" }],
  });
  assert.equal(token.success, true);
  const tokenBenefit = token.success ? token.data.benefits[0] : undefined;
  assert.equal(tokenBenefit?.type === "token" && tokenBenefit.unit, "million-token");
  assert.equal(dollars.success, true);
  assert.equal(invalidVoucher.success, false);
});

test("dated offers require a valid start and end", () => {
  const missingDates = submissionSchema.safeParse({
    ...baseSubmission,
    startsAt: undefined,
    endsAt: undefined,
  });
  const reversedDates = submissionSchema.safeParse({
    ...baseSubmission,
    startsAt: baseSubmission.endsAt,
    endsAt: baseSubmission.startsAt,
  });
  assert.equal(missingDates.success, false);
  assert.equal(reversedDates.success, false);
});

test("long-term offers do not require dates", () => {
  const result = submissionSchema.safeParse({
    ...baseSubmission,
    isLongTerm: true,
    startsAt: undefined,
    endsAt: undefined,
  });
  assert.equal(result.success, true);
});

test("list pagination falls back to safe defaults", () => {
  const result = listQuerySchema.parse({ page: "0", pageSize: "100" });
  assert.deepEqual(result, { page: 1, pageSize: 12, kind: "active" });
});

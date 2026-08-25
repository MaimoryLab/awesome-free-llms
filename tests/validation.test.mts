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

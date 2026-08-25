import { z } from "zod";

const MAX_BODY_TEXT = 2000;
const benefitAmountSchema = z.number().finite().positive();

export const benefitSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("token"),
    amount: benefitAmountSchema,
    unit: z.literal("million-token").default("million-token"),
  }),
  z.object({
    type: z.literal("voucher"),
    amount: benefitAmountSchema,
    unit: z.enum(["USD", "CNY"]).optional(),
  }),
  z.object({
    type: z.literal("points"),
    amount: benefitAmountSchema,
  }),
  z.object({
    type: z.literal("token-plan"),
    planName: z.string().trim().min(1).max(120),
    validDays: z.number().int().positive().max(36500),
  }),
  z.object({
    type: z.literal("other"),
    description: z.string().trim().min(1).max(500),
  }),
]);

const isForbiddenHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  if (/^(?:10|127)\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d{1,3})\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  return false;
};

const httpUrlSchema = z.string().trim().max(2048).refine((value) => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username && !parsed.password && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}, "必须是有效的 HTTP(S) 地址");

export const publicUrlSchema = httpUrlSchema.refine((value) => {
  try {
    return !isForbiddenHost(new URL(value).hostname);
  } catch {
    return false;
  }
}, "必须是有效的非 IP 官网地址");

const optionalUrlSchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  httpUrlSchema.optional(),
);

const isoDateSchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "必须是有效的时间"),
);

export const submissionSchema = z.object({
  providerName: z.string().trim().min(1).max(120),
  officialUrl: publicUrlSchema,
  benefits: z.array(benefitSchema).min(1).max(20),
  requiresInvite: z.boolean(),
  requiresNewAccount: z.boolean(),
  inviteCode: z.string().trim().max(256).optional(),
  claimUrl: optionalUrlSchema,
  startsAt: isoDateSchema.optional(),
  endsAt: isoDateSchema.optional(),
  isLongTerm: z.boolean(),
  notes: z.string().trim().max(MAX_BODY_TEXT).optional(),
  models: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  turnstileToken: z.string().trim().min(1).max(4096),
}).superRefine((value, ctx) => {
  if (value.requiresInvite && !value.inviteCode) {
    ctx.addIssue({ code: "custom", path: ["inviteCode"], message: "需要邀请码时必须填写邀请码" });
  }
  if (!value.requiresInvite && value.inviteCode) {
    ctx.addIssue({ code: "custom", path: ["inviteCode"], message: "不需要邀请码时请留空" });
  }
  if (value.isLongTerm && value.endsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "长期活动不能填写结束时间" });
  }
  if (!value.isLongTerm && !value.startsAt) {
    ctx.addIssue({ code: "custom", path: ["startsAt"], message: "非长期活动必须填写开始时间" });
  }
  if (!value.isLongTerm && !value.endsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "非长期活动必须填写结束时间" });
  }
  if (!value.isLongTerm && value.startsAt && value.endsAt && Date.parse(value.startsAt) > Date.parse(value.endsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "结束时间不能早于开始时间" });
  }
});

export type Benefit = z.infer<typeof benefitSchema>;
export type SubmissionInput = z.infer<typeof submissionSchema>;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(12),
  kind: z.enum(["active", "long-term"]).catch("active"),
  benefitType: z.enum(["token", "voucher", "points", "token-plan", "other"]).optional(),
});

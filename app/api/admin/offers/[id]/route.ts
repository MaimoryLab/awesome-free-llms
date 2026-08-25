import { NextResponse } from "next/server";
import { z } from "zod";
import { adminUnauthorizedResponse, hasAdminCredentials } from "@/lib/admin-auth";
import { getDb, parseOffer, type OfferRow } from "@/lib/db";
import { jsonError, validationError } from "@/lib/api";
import { submissionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
const statusSchema = z.enum(["published", "hidden"]);

function bodyRecord(body: unknown) {
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasAdminCredentials(request.headers.get("authorization"))) return adminUnauthorizedResponse();
  const { id } = await context.params;
  const row = getDb().prepare("SELECT * FROM offers WHERE id = ?").get(id) as OfferRow | undefined;
  if (!row) return jsonError("NOT_FOUND", "优惠信息不存在", 404);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonError("UNSUPPORTED_MEDIA_TYPE", "请求体必须使用 application/json", 415);
  }
  if (Number(request.headers.get("content-length") || 0) > 1_000_000) {
    return jsonError("PAYLOAD_TOO_LARGE", "请求内容过大", 413);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("INVALID_JSON", "请求体必须是有效 JSON", 400); }
  const values = bodyRecord(body);
  if (!values) return jsonError("VALIDATION_ERROR", "请求内容不符合要求", 400);
  const status = statusSchema.safeParse(values.status ?? row.status);
  const parsed = submissionSchema.safeParse({ ...values, turnstileToken: "admin" });
  if (!status.success) return validationError(status.error);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE offers SET providerName = @providerName, officialUrl = @officialUrl, benefitsJson = @benefitsJson,
      requiresInvite = @requiresInvite, requiresNewAccount = @requiresNewAccount, inviteCode = @inviteCode,
      claimUrl = @claimUrl, startsAt = @startsAt, endsAt = @endsAt, isLongTerm = @isLongTerm,
      notes = @notes, modelsJson = @modelsJson, status = @status, updatedAt = @updatedAt WHERE id = @id
  `).run({
    id,
    providerName: input.providerName.trim(),
    officialUrl: new URL(input.officialUrl).toString(),
    benefitsJson: JSON.stringify(input.benefits),
    requiresInvite: input.requiresInvite ? 1 : 0,
    requiresNewAccount: input.requiresNewAccount ? 1 : 0,
    inviteCode: input.requiresInvite ? input.inviteCode?.trim() ?? null : null,
    claimUrl: input.claimUrl ? new URL(input.claimUrl).toString() : null,
    startsAt: input.startsAt ? new Date(input.startsAt).toISOString() : null,
    endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    isLongTerm: input.isLongTerm ? 1 : 0,
    notes: input.notes?.trim() || null,
    modelsJson: input.models?.length ? JSON.stringify(input.models.map((model) => model.trim())) : null,
    status: status.data,
    updatedAt: now,
  });
  const updated = getDb().prepare("SELECT * FROM offers WHERE id = ?").get(id) as OfferRow;
  return NextResponse.json({ item: { ...parseOffer(updated), status: updated.status } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasAdminCredentials(request.headers.get("authorization"))) return adminUnauthorizedResponse();
  const { id } = await context.params;
  const result = getDb().prepare("DELETE FROM offers WHERE id = ?").run(id);
  if (!result.changes) return jsonError("NOT_FOUND", "优惠信息不存在", 404);
  return new Response(null, { status: 204 });
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, parseOffer, type OfferRow } from "@/lib/db";
import { jsonError, validationError } from "@/lib/api";
import { submissionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function verifyTurnstile(token: string, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  const forwarded = request.headers.get("x-forwarded-for");
  const remoteip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set("remoteip", remoteip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonError("UNSUPPORTED_MEDIA_TYPE", "请求体必须使用 application/json", 415);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_000_000) return jsonError("PAYLOAD_TOO_LARGE", "请求内容过大", 413);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "请求体必须是有效 JSON", 400);
  }
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  if (!(await verifyTurnstile(input.turnstileToken, request))) {
    return jsonError("TURNSTILE_FAILED", "人机验证失败，请重试", 400);
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const startsAt = input.startsAt ? new Date(input.startsAt).toISOString() : null;
  const endsAt = input.endsAt ? new Date(input.endsAt).toISOString() : null;
  getDb().prepare(`
    INSERT INTO offers (id, providerName, officialUrl, benefitsJson, requiresInvite, inviteCode, claimUrl,
      startsAt, endsAt, isLongTerm, notes, modelsJson, status, createdAt, updatedAt)
    VALUES (@id, @providerName, @officialUrl, @benefitsJson, @requiresInvite, @inviteCode, @claimUrl,
      @startsAt, @endsAt, @isLongTerm, @notes, @modelsJson, 'published', @createdAt, @updatedAt)
  `).run({
    id,
    providerName: input.providerName.trim(),
    officialUrl: new URL(input.officialUrl).toString(),
    benefitsJson: JSON.stringify(input.benefits),
    requiresInvite: input.requiresInvite ? 1 : 0,
    inviteCode: input.requiresInvite ? input.inviteCode?.trim() ?? null : null,
    claimUrl: input.claimUrl ? new URL(input.claimUrl).toString() : null,
    startsAt,
    endsAt,
    isLongTerm: input.isLongTerm ? 1 : 0,
    notes: input.notes?.trim() || null,
    modelsJson: input.models?.length ? JSON.stringify(input.models.map((model) => model.trim())) : null,
    createdAt: now,
    updatedAt: now,
  });
  const row = getDb().prepare("SELECT * FROM offers WHERE id = ?").get(id) as OfferRow;
  return NextResponse.json({ item: parseOffer(row) }, { status: 201 });
}

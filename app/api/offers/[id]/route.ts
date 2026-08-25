import { NextResponse } from "next/server";
import { getDb, parseOffer, type OfferRow } from "@/lib/db";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const row = getDb().prepare("SELECT * FROM offers WHERE id = ? AND status = 'published'").get(id) as OfferRow | undefined;
  if (!row) return jsonError("NOT_FOUND", "优惠信息不存在", 404);
  return NextResponse.json({ item: parseOffer(row) });
}

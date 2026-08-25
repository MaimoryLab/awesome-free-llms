import { NextResponse } from "next/server";
import { adminUnauthorizedResponse, hasAdminCredentials } from "@/lib/admin-auth";
import { getDb, parseOffer, type OfferRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAdminCredentials(request.headers.get("authorization"))) return adminUnauthorizedResponse();
  const rows = getDb().prepare("SELECT * FROM offers ORDER BY updatedAt DESC, createdAt DESC, id DESC").all() as OfferRow[];
  return NextResponse.json({ items: rows.map((row) => ({ ...parseOffer(row), status: row.status })) });
}

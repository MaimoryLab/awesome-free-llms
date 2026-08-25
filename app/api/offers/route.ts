import { NextResponse } from "next/server";
import { getDb, parseOffer, type OfferRow } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { listQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
    benefitType: url.searchParams.get("benefitType") ?? undefined,
  });
  if (!parsed.success) return jsonError("VALIDATION_ERROR", "分页参数不符合要求", 400);

  const { page, pageSize, kind, benefitType } = parsed.data;
  const now = new Date().toISOString();
  const conditions = ["status = 'published'"];
  const params: Array<string | number> = [];
  if (kind === "long-term") {
    conditions.push("isLongTerm = 1");
  } else {
    conditions.push("isLongTerm = 0", "startsAt <= ?", "endsAt >= ?");
    params.push(now, now);
  }
  if (benefitType) {
    conditions.push("EXISTS (SELECT 1 FROM json_each(benefitsJson) WHERE json_extract(json_each.value, '$.type') = ?)");
    params.push(benefitType);
  }
  const where = conditions.join(" AND ");
  const db = getDb();
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM offers WHERE ${where}`).get(...params) as { total: number };
  const offset = (page - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM offers WHERE ${where} ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as OfferRow[];
  const total = Number(totalRow.total);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return NextResponse.json({
    items: items.map(parseOffer),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  });
}

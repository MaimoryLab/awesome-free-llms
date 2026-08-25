import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasAdminCredentials } from "@/lib/admin-auth";

export function proxy(request: NextRequest) {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: { code: "ADMIN_NOT_CONFIGURED", message: "后台认证尚未配置" } }, { status: 503 });
  }
  if (hasAdminCredentials(request.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("需要后台账号和密码", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Free LLM Hub Admin", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

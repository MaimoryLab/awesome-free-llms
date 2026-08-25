import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonError(code: string, message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

export function validationError(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_form";
    if (!fields[field]) fields[field] = issue.message;
  }
  return jsonError("VALIDATION_ERROR", "提交内容不符合要求", 400, fields);
}

export function parseJson<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

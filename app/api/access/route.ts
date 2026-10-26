import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    canSubmit: Boolean(process.env.GITHUB_TOKEN && (process.env.CONSOLE_ADMIN_KEY || "").length >= 24)
  }, { headers: { "Cache-Control": "no-store" } });
}

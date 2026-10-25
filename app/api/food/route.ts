import { NextRequest, NextResponse } from "next/server";
import { readConcept } from "@/lib/github";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path") || "";
    return NextResponse.json(await readConcept(path));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

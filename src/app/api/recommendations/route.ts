import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function optionalNumber(value: string | null) {
  if (value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const supabase = createSupabaseServerClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  }).rpc("get_recommendations", {
    east: optionalNumber(search.get("east")),
    north: optionalNumber(search.get("north")),
    page_offset: Math.max(0, optionalNumber(search.get("offset")) ?? 0),
    page_size: Math.min(80, Math.max(1, optionalNumber(search.get("limit")) ?? 40)),
    profile_account_id: search.get("accountId") || null,
    south: optionalNumber(search.get("south")),
    west: optionalNumber(search.get("west")),
  });

  if (error) {
    const missingFunction = error.code === "PGRST202" || error.message?.includes("get_recommendations");

    return NextResponse.json(
      { error: missingFunction ? "Consolidated recommendations are not installed." : error.message },
      { status: missingFunction ? 501 : 500 },
    );
  }

  return NextResponse.json(data ?? [], {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}

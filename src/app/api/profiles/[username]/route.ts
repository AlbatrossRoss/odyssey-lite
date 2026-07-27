import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(request: NextRequest, context: ProfileRouteContext) {
  const { username } = await context.params;
  const supabase = createSupabaseServerClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  }).rpc("get_profile_bundle", {
    post_page_offset: 0,
    post_page_size: 24,
    profile_username: username,
    viewer_account_id: request.nextUrl.searchParams.get("viewerId") || null,
  });

  if (error) {
    const missingFunction = error.code === "PGRST202" || error.message?.includes("get_profile_bundle");

    return NextResponse.json(
      { error: missingFunction ? "Consolidated profiles are not installed." : error.message },
      { status: missingFunction ? 501 : 500 },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}

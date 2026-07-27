import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cloudflareStreamDeliveryUrl, getCloudflareStreamVideo } from "@/lib/cloudflare/stream";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accountSessionCookie = "odyssey-lite-account-id";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await context.params;
    const accountId = new URL(request.url).searchParams.get("accountId") ?? "";
    const sessionAccountId = (await cookies()).get(accountSessionCookie)?.value ?? "";

    if (!accountId || accountId !== sessionAccountId) {
      return NextResponse.json({ error: "Log in again before checking media." }, { status: 401 });
    }

    const video = await getCloudflareStreamVideo(assetId);
    const failed = video.status?.state === "error";
    const ready = Boolean(video.readyToStream);
    const deliveryUrl = ready ? cloudflareStreamDeliveryUrl(video) : null;
    const status = failed ? "failed" : ready ? "ready" : "processing";
    const supabase = createSupabaseServerClient();

    await supabase
      .from("media_assets")
      .update({
        delivery_url: deliveryUrl,
        duration_seconds: video.duration ?? null,
        height: video.input?.height ?? null,
        metadata: {
          dash: video.playback?.dash ?? null,
          error: video.status?.errorReasonText ?? null,
          hls: video.playback?.hls ?? null,
          thumbnail: video.thumbnail ?? null,
        },
        status,
        width: video.input?.width ?? null,
      })
      .eq("provider", "cloudflare_stream")
      .eq("provider_asset_id", assetId)
      .eq("owner_account_id", accountId);

    return NextResponse.json({
      deliveryUrl,
      error: failed ? video.status?.errorReasonText || "Cloudflare could not process this video." : null,
      ready,
      status,
      thumbnailUrl: video.thumbnail ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check video processing." },
      { status: 500 },
    );
  }
}


import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cloudflareStreamDeliveryUrl, type CloudflareStreamVideo } from "@/lib/cloudflare/stream";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Stream webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("webhook-signature") ?? "";
  const signature = parseSignature(signatureHeader);

  if (!signature || Math.abs(Date.now() / 1000 - signature.time) > 300) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const expected = createHmac("sha256", secret).update(`${signature.time}.${rawBody}`).digest("hex");
  const actualBytes = Buffer.from(signature.value, "hex");
  const expectedBytes = Buffer.from(expected, "hex");

  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const video = JSON.parse(rawBody) as CloudflareStreamVideo;
  const failed = video.status?.state === "error";
  const ready = Boolean(video.readyToStream);

  if (video.uid) {
    const supabase = createSupabaseServerClient();
    await supabase
      .from("media_assets")
      .update({
        delivery_url: ready ? cloudflareStreamDeliveryUrl(video) : null,
        duration_seconds: video.duration ?? null,
        height: video.input?.height ?? null,
        metadata: {
          dash: video.playback?.dash ?? null,
          error: video.status?.errorReasonText ?? null,
          hls: video.playback?.hls ?? null,
          thumbnail: video.thumbnail ?? null,
        },
        status: failed ? "failed" : ready ? "ready" : "processing",
        width: video.input?.width ?? null,
      })
      .eq("provider", "cloudflare_stream")
      .eq("provider_asset_id", video.uid);
  }

  return NextResponse.json({ received: true });
}

function parseSignature(value: string) {
  const fields = Object.fromEntries(
    value.split(",").map((part) => {
      const [key, fieldValue] = part.trim().split("=", 2);
      return [key, fieldValue];
    }),
  );
  const time = Number(fields.time);

  return Number.isFinite(time) && fields.sig1 ? { time, value: fields.sig1 } : null;
}


export type CloudflareImageVariant = "avatar" | "card" | "feed" | "hero" | "public" | "thumbnail";

export function withCloudflareImageVariant(url: string, variant: CloudflareImageVariant) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== "imagedelivery.net") {
      return url;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);

    if (segments.length < 3) {
      return url;
    }

    segments[segments.length - 1] = variant;
    parsed.pathname = `/${segments.join("/")}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function isCloudflareStreamIframe(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(".cloudflarestream.com") && parsed.pathname.endsWith("/iframe");
  } catch {
    return false;
  }
}

export function cloudflareStreamPlayerUrl(url: string, { autoPlay, controls, muted }: { autoPlay: boolean; controls: boolean; muted: boolean }) {
  const parsed = new URL(url);
  parsed.searchParams.set("autoplay", String(autoPlay));
  parsed.searchParams.set("controls", String(controls));
  parsed.searchParams.set("loop", "true");
  parsed.searchParams.set("muted", String(muted));
  parsed.searchParams.set("preload", "auto");
  return parsed.toString();
}

export function cloudflareStreamThumbnailUrl(url: string, width = 640, height = 640) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  const assetId = segments[0];

  parsed.pathname = `/${assetId}/thumbnails/thumbnail.jpg`;
  parsed.search = "";
  parsed.searchParams.set("time", "1s");
  parsed.searchParams.set("width", String(width));
  parsed.searchParams.set("height", String(height));
  parsed.searchParams.set("fit", "crop");
  return parsed.toString();
}

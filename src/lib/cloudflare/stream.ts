import "server-only";

const cloudflareApiBaseUrl = "https://api.cloudflare.com/client/v4";

type CloudflareStreamPayload = {
  errors?: Array<{ message?: string }>;
  result?: CloudflareStreamVideo;
  success?: boolean;
};

export type CloudflareStreamVideo = {
  duration?: number;
  input?: {
    height?: number;
    width?: number;
  };
  meta?: Record<string, string>;
  playback?: {
    dash?: string;
    hls?: string;
  };
  preview?: string;
  readyToStream?: boolean;
  status?: {
    errorReasonCode?: string;
    errorReasonText?: string;
    state?: string;
  };
  thumbnail?: string;
  uid?: string;
  uploadURL?: string;
};

export type CloudflareStreamDirectUpload = {
  assetId: string;
  uploadUrl: string;
};

export async function createCloudflareStreamDirectUpload({
  accountId,
  filename,
}: {
  accountId: string;
  filename: string;
}): Promise<CloudflareStreamDirectUpload> {
  const response = await cloudflareStreamRequest("/stream/direct_upload", {
    body: JSON.stringify({
      maxDurationSeconds: 60,
      meta: {
        filename: filename.slice(0, 255),
        ownerAccountId: accountId,
        source: "odyssey-lite",
      },
      requireSignedURLs: false,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const assetId = response.uid;
  const uploadUrl = response.uploadURL;

  if (!assetId || !uploadUrl) {
    throw new Error("Cloudflare Stream did not return an upload URL.");
  }

  return { assetId, uploadUrl };
}

export async function getCloudflareStreamVideo(assetId: string) {
  return cloudflareStreamRequest(`/stream/${encodeURIComponent(assetId)}`, {
    method: "GET",
  });
}

export function cloudflareStreamDeliveryUrl(video: CloudflareStreamVideo) {
  if (!video.uid || !video.preview) {
    return null;
  }

  try {
    const previewUrl = new URL(video.preview);
    previewUrl.pathname = `/${video.uid}/iframe`;
    previewUrl.search = "";
    return previewUrl.toString();
  } catch {
    return null;
  }
}

async function cloudflareStreamRequest(path: string, init: RequestInit) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Stream is not configured.");
  }

  const response = await fetch(`${cloudflareApiBaseUrl}/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...init.headers,
    },
  });
  const payload = (await response.json()) as CloudflareStreamPayload;

  if (!response.ok || !payload.success || !payload.result) {
    const detail = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(detail || "Cloudflare Stream request failed.");
  }

  return payload.result;
}


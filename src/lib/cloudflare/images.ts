import "server-only";

const cloudflareApiBaseUrl = "https://api.cloudflare.com/client/v4";

type CloudflareDirectUploadResponse = {
  errors?: Array<{ message?: string }>;
  result?: {
    id?: string;
    uploadURL?: string;
  };
  success?: boolean;
};

export type CloudflareImageDirectUpload = {
  assetId: string;
  deliveryUrl: string;
  uploadUrl: string;
};

export async function createCloudflareImageDirectUpload({
  accountId,
  filename,
}: {
  accountId: string;
  filename: string;
}): Promise<CloudflareImageDirectUpload> {
  const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountHash = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH;

  if (!cloudflareAccountId || !cloudflareApiToken || !accountHash) {
    throw new Error("Cloudflare Images is not configured.");
  }

  const body = new FormData();
  body.set("requireSignedURLs", "false");
  body.set(
    "metadata",
    JSON.stringify({
      ownerAccountId: accountId,
      originalFilename: filename.slice(0, 255),
      source: "odyssey-lite",
    }),
  );

  const response = await fetch(`${cloudflareApiBaseUrl}/accounts/${cloudflareAccountId}/images/v2/direct_upload`, {
    body,
    headers: {
      Authorization: `Bearer ${cloudflareApiToken}`,
    },
    method: "POST",
  });
  const payload = (await response.json()) as CloudflareDirectUploadResponse;
  const assetId = payload.result?.id;
  const uploadUrl = payload.result?.uploadURL;

  if (!response.ok || !payload.success || !assetId || !uploadUrl) {
    const detail = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(detail || "Cloudflare could not create an image upload.");
  }

  return {
    assetId,
    deliveryUrl: cloudflareImageUrl(accountHash, assetId, "hero"),
    uploadUrl,
  };
}

function cloudflareImageUrl(accountHash: string, assetId: string, variant: string) {
  return `https://imagedelivery.net/${encodeURIComponent(accountHash)}/${encodeURIComponent(assetId)}/${encodeURIComponent(variant)}`;
}


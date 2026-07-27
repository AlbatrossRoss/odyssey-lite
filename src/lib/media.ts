"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const postMediaBucket = "app-post-media";
const maxUploadImageDimension = 1800;
const imageCompressionQuality = 0.82;
const skipCompressionBelowBytes = 900 * 1024;

function isCompressibleImage(file: File) {
  if (!file.type.startsWith("image/")) {
    return false;
  }

  return !["image/gif", "image/svg+xml"].includes(file.type);
}

function extensionForFile(file: File) {
  const explicitExtension = file.name.split(".").pop()?.toLowerCase();

  if (explicitExtension && explicitExtension.length <= 6) {
    return explicitExtension.replace(/[^a-z0-9]/g, "") || "jpg";
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/quicktime") return "mov";
  if (file.type === "video/webm") return "webm";

  return "jpg";
}

export async function uploadPostMedia(file: File, accountId: string) {
  if (file.type.startsWith("image/")) {
    return uploadImageToCloudflare(file, accountId);
  }

  if (file.type.startsWith("video/")) {
    return uploadVideoToCloudflare(file, accountId);
  }

  return uploadLegacyPostMedia(file, accountId);
}

async function uploadImageToCloudflare(file: File, accountId: string) {
  const uploadFile = await prepareMediaForUpload(file);
  const response = await fetch("/api/media/images/direct-upload", {
    body: JSON.stringify({
      accountId,
      filename: uploadFile.name,
      mimeType: uploadFile.type,
      size: uploadFile.size,
    }),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const directUpload = (await response.json()) as {
    assetId?: string;
    deliveryUrl?: string;
    error?: string;
    uploadUrl?: string;
  };

  if (!response.ok || !directUpload.assetId || !directUpload.deliveryUrl || !directUpload.uploadUrl) {
    throw new Error(directUpload.error || "Unable to prepare the image upload.");
  }

  const form = new FormData();
  form.set("file", uploadFile);
  const uploadResponse = await fetch(directUpload.uploadUrl, {
    body: form,
    method: "POST",
  });

  if (!uploadResponse.ok) {
    throw new Error("Cloudflare could not finish the image upload.");
  }

  await registerCloudflareImage({
    accountId,
    assetId: directUpload.assetId,
    deliveryUrl: directUpload.deliveryUrl,
    file: uploadFile,
  });

  return directUpload.deliveryUrl;
}

async function registerCloudflareImage({
  accountId,
  assetId,
  deliveryUrl,
  file,
}: {
  accountId: string;
  assetId: string;
  deliveryUrl: string;
  file: File;
}) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("media_assets").upsert(
    {
      delivery_url: deliveryUrl,
      kind: "image",
      mime_type: file.type || null,
      original_filename: file.name,
      owner_account_id: accountId,
      provider: "cloudflare_images",
      provider_asset_id: assetId,
      status: "ready",
    },
    { onConflict: "provider,provider_asset_id" },
  );

  if (error && !mediaAssetsTableMissing(error)) {
    throw error;
  }
}

function mediaAssetsTableMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42P01" || code === "PGRST205" || message.includes("media_assets");
}

async function uploadVideoToCloudflare(file: File, accountId: string) {
  const response = await fetch("/api/media/videos/direct-upload", {
    body: JSON.stringify({
      accountId,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    }),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const directUpload = (await response.json()) as { assetId?: string; error?: string; uploadUrl?: string };

  if (!response.ok || !directUpload.assetId || !directUpload.uploadUrl) {
    throw new Error(directUpload.error || "Unable to prepare the video upload.");
  }

  const form = new FormData();
  form.set("file", file);
  const uploadResponse = await fetch(directUpload.uploadUrl, { body: form, method: "POST" });

  if (!uploadResponse.ok) {
    throw new Error("Cloudflare could not finish the video upload.");
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("media_assets").upsert(
    {
      kind: "video",
      mime_type: file.type || null,
      original_filename: file.name,
      owner_account_id: accountId,
      provider: "cloudflare_stream",
      provider_asset_id: directUpload.assetId,
      status: "processing",
    },
    { onConflict: "provider,provider_asset_id" },
  );

  if (error) throw error;

  return waitForStreamVideo(directUpload.assetId, accountId);
}

async function waitForStreamVideo(assetId: string, accountId: string) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const response = await fetch(`/api/media/videos/${encodeURIComponent(assetId)}/status?accountId=${encodeURIComponent(accountId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const result = (await response.json()) as { deliveryUrl?: string | null; error?: string | null; status?: string };

    if (!response.ok || result.status === "failed") {
      throw new Error(result.error || "Cloudflare could not process this video.");
    }

    if (result.status === "ready" && result.deliveryUrl) {
      return result.deliveryUrl;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }

  throw new Error("The video is still processing. Try publishing again in a moment.");
}

async function uploadLegacyPostMedia(file: File, accountId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add public Supabase environment variables to upload media.");
  }

  const supabase = createSupabaseBrowserClient();
  const uploadFile = await prepareMediaForUpload(file);
  const extension = extensionForFile(uploadFile);
  const path = `${accountId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(postMediaBucket).upload(path, uploadFile, {
    cacheControl: "31536000",
    contentType: uploadFile.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    if (error.message.toLowerCase().includes("bucket not found")) {
      throw new Error("Post media storage is not set up yet. Run the 0005_app_post_media Supabase migration, then try again.");
    }

    throw error;
  }

  const { data } = supabase.storage.from(postMediaBucket).getPublicUrl(path);
  return data.publicUrl;
}

async function prepareMediaForUpload(file: File) {
  if (!isCompressibleImage(file) || file.size <= skipCompressionBelowBytes) {
    return file;
  }

  try {
    return await compressImageFile(file);
  } catch {
    return file;
  }
}

async function compressImageFile(file: File) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxUploadImageDimension / Math.max(image.naturalWidth, image.naturalHeight));

  if (scale >= 1 && file.size <= skipCompressionBelowBytes * 1.75) {
    URL.revokeObjectURL(image.src);
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", imageCompressionQuality);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  return new File([blob], replaceFileExtension(file.name, "jpg"), {
    lastModified: file.lastModified,
    type: "image/jpeg",
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image for compression."));
    };
    image.src = url;
  });
}

function replaceFileExtension(filename: string, extension: string) {
  const baseName = filename.replace(/\.[^.]+$/, "") || "media";

  return `${baseName}.${extension}`;
}

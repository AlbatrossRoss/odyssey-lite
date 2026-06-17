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

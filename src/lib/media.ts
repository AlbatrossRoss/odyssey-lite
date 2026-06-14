"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const postMediaBucket = "app-post-media";

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
  const extension = extensionForFile(file);
  const path = `${accountId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(postMediaBucket).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "image/jpeg",
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

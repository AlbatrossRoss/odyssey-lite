"use client";

import type { AppPostMediaType } from "@/lib/posts";

type PostMediaPreviewProps = {
  alt?: string;
  className: string;
  fallbackUrl?: string;
  mediaType?: AppPostMediaType;
  src: string;
};

export function PostMediaPreview({ alt = "", className, fallbackUrl, mediaType = "image", src }: PostMediaPreviewProps) {
  if (mediaType === "video") {
    return <video aria-label={alt} autoPlay className={className} loop muted playsInline preload="metadata" src={src} />;
  }

  return (
    <img
      alt={alt}
      className={className}
      onError={(event) => {
        if (fallbackUrl && event.currentTarget.src !== fallbackUrl) {
          event.currentTarget.src = fallbackUrl;
        }
      }}
      src={src}
    />
  );
}

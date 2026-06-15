"use client";

import type { AppPostMediaType } from "@/lib/posts";

type PostMediaPreviewProps = {
  alt?: string;
  className: string;
  controls?: boolean;
  fallbackUrl?: string;
  mediaType?: AppPostMediaType;
  muted?: boolean;
  src: string;
};

export function PostMediaPreview({ alt = "", className, controls = false, fallbackUrl, mediaType = "image", muted = true, src }: PostMediaPreviewProps) {
  if (mediaType === "video") {
    return <video aria-label={alt} autoPlay className={className} controls={controls} loop muted={muted} playsInline preload="metadata" src={src} />;
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

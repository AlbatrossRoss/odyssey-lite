"use client";

import { useEffect, useRef } from "react";
import type { AppPostMediaType } from "@/lib/posts";

type PostMediaPreviewProps = {
  alt?: string;
  autoPlay?: boolean;
  className: string;
  controls?: boolean;
  fallbackUrl?: string;
  mediaType?: AppPostMediaType;
  muted?: boolean;
  src: string;
};

export function PostMediaPreview({ alt = "", autoPlay = true, className, controls = false, fallbackUrl, mediaType = "image", muted = true, src }: PostMediaPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || mediaType !== "video") {
      return;
    }

    if (!autoPlay) {
      video.pause();
      return;
    }

    video.muted = muted;
    void video.play().catch(() => {
      // Browser autoplay rules can still block a preview; native controls remain available where shown.
    });
  }, [autoPlay, mediaType, muted, src]);

  if (mediaType === "video") {
    return (
      <video
        aria-label={alt}
        autoPlay={autoPlay}
        className={className}
        controls={controls}
        key={src}
        loop
        muted={muted}
        onCanPlay={(event) => {
          if (autoPlay) {
            event.currentTarget.play().catch(() => undefined);
          }
        }}
        playsInline
        preload={autoPlay ? "auto" : "metadata"}
        ref={videoRef}
        src={src}
      />
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={(event) => {
        if (fallbackUrl && event.currentTarget.src !== fallbackUrl) {
          event.currentTarget.src = fallbackUrl;
        }
      }}
      src={src}
    />
  );
}

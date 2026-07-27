"use client";

import { useEffect, useRef } from "react";
import {
  cloudflareStreamPlayerUrl,
  cloudflareStreamThumbnailUrl,
  isCloudflareStreamIframe,
  withCloudflareImageVariant,
  type CloudflareImageVariant,
} from "@/lib/mediaDelivery";
import type { AppPostMediaType } from "@/lib/posts";

type PostMediaPreviewProps = {
  alt?: string;
  autoPlay?: boolean;
  className: string;
  controls?: boolean;
  fallbackUrl?: string;
  imageVariant?: CloudflareImageVariant;
  mediaType?: AppPostMediaType;
  muted?: boolean;
  src: string;
};

export function PostMediaPreview({
  alt = "",
  autoPlay = true,
  className,
  controls = false,
  fallbackUrl,
  imageVariant = "hero",
  mediaType = "image",
  muted = true,
  src,
}: PostMediaPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVideo = mediaType === "video" || isVideoSrc(src);
  const isStream = isCloudflareStreamIframe(src);
  const useStreamThumbnail = isStream && (imageVariant === "card" || imageVariant === "thumbnail");

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !isVideo) {
      return;
    }

    video.defaultMuted = muted;
    video.muted = muted;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    if (!autoPlay) {
      video.pause();
      return;
    }

    requestAnimationFrame(() => {
      video.play().catch(() => {
        // Browser autoplay rules can still block a preview; native controls remain available where shown.
      });
    });
  }, [autoPlay, isVideo, muted, src]);

  if (useStreamThumbnail) {
    return (
      <img
        alt={alt}
        className={className}
        loading="lazy"
        src={cloudflareStreamThumbnailUrl(src)}
      />
    );
  }

  if (isStream) {
    return (
      <iframe
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        aria-label={alt}
        className={`${className} ${controls ? "" : "pointer-events-none"}`}
        loading="lazy"
        src={cloudflareStreamPlayerUrl(src, { autoPlay, controls, muted })}
      />
    );
  }

  if (isVideo) {
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
      src={withCloudflareImageVariant(src, imageVariant)}
    />
  );
}

function isVideoSrc(src: string) {
  return /\.(avi|m4v|mov|mp4|webm)(\?|#|$)/i.test(src);
}

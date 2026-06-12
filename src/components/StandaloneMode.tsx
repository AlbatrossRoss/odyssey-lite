"use client";

import { useEffect } from "react";

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

export function StandaloneMode() {
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const root = document.documentElement;
    let resetTimer: number | undefined;

    function syncStandaloneMode() {
      const isStandalone = media.matches || (window.navigator as StandaloneNavigator).standalone === true;
      root.classList.toggle("standalone-pwa", isStandalone);

      if (!isStandalone) {
        return;
      }

      const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');

      if (!viewport) {
        return;
      }

      const coveredViewport = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
      viewport.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
      resetTimer = window.setTimeout(() => {
        viewport.setAttribute("content", coveredViewport);
      }, 100);
    }

    syncStandaloneMode();
    media.addEventListener("change", syncStandaloneMode);

    return () => {
      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }

      media.removeEventListener("change", syncStandaloneMode);
      root.classList.remove("standalone-pwa");
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

export function StandaloneMode() {
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const root = document.documentElement;

    function syncStandaloneMode() {
      const isStandalone = media.matches || (window.navigator as StandaloneNavigator).standalone === true;
      root.classList.toggle("standalone-pwa", isStandalone);
    }

    syncStandaloneMode();
    media.addEventListener("change", syncStandaloneMode);

    return () => {
      media.removeEventListener("change", syncStandaloneMode);
      root.classList.remove("standalone-pwa");
    };
  }, []);

  return null;
}

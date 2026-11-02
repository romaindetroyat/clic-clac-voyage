"use client";

import { useEffect } from "react";

export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* Sans service worker, l'app fonctionne quand même. */
    });
  }, []);
  return null;
}

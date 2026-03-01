"use client";

import { useEffect } from "react";

const isLocalHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1";

export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!("serviceWorker" in navigator) || !isLocalHost(window.location.hostname)) {
      return;
    }

    let cancelled = false;

    const clear = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      } catch {
        // Ignore cleanup errors in local development.
      }

      if (cancelled) return;

      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // Ignore cache cleanup errors in local development.
      }
    };

    void clear();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

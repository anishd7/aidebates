"use client";

import { useEffect } from "react";
import { useApiKeysStore } from "@/stores/apiKeys";

/**
 * Client component that runs one-time initialization when the
 * authenticated app shell mounts: fetches and caches API keys.
 */
export default function AppInitializer() {
  const fetchKeys = useApiKeysStore((s) => s.fetchKeys);
  const isLoaded = useApiKeysStore((s) => s.isLoaded);

  useEffect(() => {
    if (!isLoaded) {
      fetchKeys();
    }
  }, [fetchKeys, isLoaded]);

  return null;
}

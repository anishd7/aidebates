import { create } from "zustand";

import { decryptKeys, listKeys } from "@/lib/api";

interface ProviderMeta {
  key_last_four: string;
  updated_at: string;
}

interface ApiKeysState {
  /** Decrypted keys — in-memory only, never persisted */
  keys: {
    openai?: string;
    anthropic?: string;
    tavily?: string;
  };

  /** Non-sensitive metadata for UI display */
  configured: {
    openai?: ProviderMeta;
    anthropic?: ProviderMeta;
    tavily?: ProviderMeta;
  };

  isLoaded: boolean;
  isLoading: boolean;

  fetchKeys: () => Promise<void>;
  refreshKeys: () => Promise<void>;
  hasKey: (provider: string) => boolean;
  clearKeys: () => void;
}

export const useApiKeysStore = create<ApiKeysState>((set, get) => ({
  keys: {},
  configured: {},
  isLoaded: false,
  isLoading: false,

  fetchKeys: async () => {
    set({ isLoading: true });
    try {
      const [keyList, decrypted] = await Promise.all([
        listKeys(),
        decryptKeys(),
      ]);

      const configured: ApiKeysState["configured"] = {};
      for (const k of keyList.keys) {
        const provider = k.provider as keyof ApiKeysState["configured"];
        if (provider === "openai" || provider === "anthropic" || provider === "tavily") {
          configured[provider] = {
            key_last_four: k.key_last_four,
            updated_at: k.updated_at,
          };
        }
      }

      const keys: ApiKeysState["keys"] = {};
      for (const [provider, value] of Object.entries(decrypted.keys)) {
        if (
          (provider === "openai" || provider === "anthropic" || provider === "tavily") &&
          value != null
        ) {
          keys[provider] = value;
        }
      }

      set({ keys, configured, isLoaded: true, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  refreshKeys: async () => {
    await get().fetchKeys();
  },

  hasKey: (provider: string) => {
    return provider in get().keys && get().keys[provider as keyof ApiKeysState["keys"]] != null;
  },

  clearKeys: () => {
    set({ keys: {}, configured: {}, isLoaded: false, isLoading: false });
  },
}));

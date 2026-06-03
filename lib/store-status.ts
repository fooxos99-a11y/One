import { DEFAULT_STORE_STATUS_SETTINGS } from "@/lib/site-settings-constants"

export type StoreStatusSettings = {
  isOpen: boolean
}

export function normalizeStoreStatus(value: unknown): StoreStatusSettings {
  if (value && typeof value === "object" && "isOpen" in value) {
    return {
      isOpen: (value as { isOpen?: unknown }).isOpen !== false,
    }
  }

  return {
    isOpen: DEFAULT_STORE_STATUS_SETTINGS.isOpen,
  }
}
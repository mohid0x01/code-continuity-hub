/**
 * Developer / SaaS admin settings — stored in localStorage (client-only, BYOK).
 * Read inside React with useDevSettings(); persisted automatically.
 */
export interface ModelEntry {
  id: string;
  enabled: boolean;
  label: string;
  provider: "lovable" | "openai" | "google" | "anthropic";
}

export interface DevSettings {
  modelChain: ModelEntry[];
  apiKeys: {
    openai: string;
    google: string;
    anthropic: string;
  };
  rateLimit: {
    maxJobsPerMinute: number;
    timeoutMs: number;
    retryCount: number;
  };
  preferences: {
    theme: "dark" | "light";
    autoRetryOnFail: boolean;
    notifyOnCompletion: boolean;
  };
}

export const DEFAULT_SETTINGS: DevSettings = {
  modelChain: [
    { id: "google/gemini-2.5-flash", enabled: true, label: "Gemini 2.5 Flash", provider: "lovable" },
    { id: "google/gemini-2.5-pro", enabled: true, label: "Gemini 2.5 Pro", provider: "lovable" },
    { id: "openai/gpt-5-mini", enabled: true, label: "GPT-5 Mini", provider: "lovable" },
    { id: "openai/gpt-5", enabled: false, label: "GPT-5", provider: "lovable" },
  ],
  apiKeys: { openai: "", google: "", anthropic: "" },
  rateLimit: { maxJobsPerMinute: 30, timeoutMs: 60000, retryCount: 3 },
  preferences: { theme: "dark", autoRetryOnFail: true, notifyOnCompletion: true },
};

const KEY = "sceneiq-dev-settings-v1";

export function loadDevSettings(): DevSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveDevSettings(s: DevSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("sceneiq-settings-changed"));
}

import { useEffect, useState } from "react";

export function useDevSettings() {
  const [settings, setSettings] = useState<DevSettings>(() => loadDevSettings());
  useEffect(() => {
    const handler = () => setSettings(loadDevSettings());
    window.addEventListener("sceneiq-settings-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("sceneiq-settings-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const update = (patch: Partial<DevSettings>) => {
    const next = { ...settings, ...patch };
    saveDevSettings(next);
    setSettings(next);
  };
  return { settings, update };
}

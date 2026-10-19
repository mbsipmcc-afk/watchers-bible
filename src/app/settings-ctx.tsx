import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applySettings,
  loadSettings,
  saveSettings,
  type Settings,
} from "../lib/settings";

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

const SettingsCtx = createContext<Ctx>({
  settings: loadSettings(),
  update: () => undefined,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      applySettings(next);
      return next;
    });
  };

  useEffect(() => {
    applySettings(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SettingsCtx.Provider value={{ settings, update }}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  return useContext(SettingsCtx);
}

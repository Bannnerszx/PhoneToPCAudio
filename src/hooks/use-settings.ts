import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type Settings = {
  host: string;
  latencyMs: number;
};

export const MIN_LATENCY_MS = 30;
export const MAX_LATENCY_MS = 250;

const STORAGE_KEY = 'settings';
const DEFAULTS: Settings = { host: '', latencyMs: 80 };

// Settings persisted on the device. `loaded` is false until storage has been read.
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) setSettings({ ...DEFAULTS, ...JSON.parse(json) });
      })
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, loaded, update };
}

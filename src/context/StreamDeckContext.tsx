import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { StreamDeckContext } from "./StreamDeckReactContext";
import type { StreamDeckKeyAction } from "../types/streamdeck";

const STORAGE_KEY = "mirabox-controller:key-config:v1";

type StoredStreamDeckKey = {
  image?: string;
  label?: string;
  action?: StreamDeckKeyAction;
};

export interface StreamDeckKey {
  id: number;
  row: number;
  column: number;
  image?: string;
  label?: string;
  action?: StreamDeckKeyAction;
}

export interface StreamDeckState {
  isConnected: boolean;
  keys: StreamDeckKey[];
  selectedKeyId: number | null;
}

export interface StreamDeckContextType {
  state: StreamDeckState;
  setConnected: (connected: boolean) => void;
  updateKey: (keyId: number, updates: Partial<StreamDeckKey>) => void;
  clearKeyImageState: (keyId: number) => void;
  selectKey: (keyId: number) => void;
  getKey: (keyId: number) => StreamDeckKey | undefined;
}

// Initialize grid with 3x5 = 15 keys (MiraBox HSV 293S layout)
const initializeGrid = (): StreamDeckKey[] => {
  const keys: StreamDeckKey[] = [];
  let id = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      keys.push({
        id,
        row,
        column: col,
      });
      id++;
    }
  }
  return keys;
};

const mergeStoredKeys = (baseKeys: StreamDeckKey[]): StreamDeckKey[] => {
  if (typeof window === "undefined") {
    return baseKeys;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return baseKeys;
  }

  try {
    const storedKeys = JSON.parse(rawValue) as Record<
      string,
      StoredStreamDeckKey
    >;
    return baseKeys.map((key) => {
      const storedKey = storedKeys[String(key.id)];
      return storedKey ? { ...key, ...storedKey } : key;
    });
  } catch (error) {
    console.error("Failed to restore saved key configuration", error);
    return baseKeys;
  }
};

const persistKeys = (keys: StreamDeckKey[]) => {
  if (typeof window === "undefined") {
    return;
  }

  const payload = keys.reduce<Record<string, StoredStreamDeckKey>>(
    (accumulator, key) => {
      if (key.image || key.label || key.action) {
        accumulator[String(key.id)] = {
          image: key.image,
          label: key.label,
          action: key.action,
        };
      }

      return accumulator;
    },
    {},
  );

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const StreamDeckProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StreamDeckState>({
    isConnected: false,
    keys: mergeStoredKeys(initializeGrid()),
    selectedKeyId: null,
  });

  const setConnected = useCallback((connected: boolean) => {
    setState((prev) => ({ ...prev, isConnected: connected }));
  }, []);

  const updateKey = useCallback(
    (keyId: number, updates: Partial<StreamDeckKey>) => {
      setState((prev) => {
        const keys = prev.keys.map((key) =>
          key.id === keyId ? { ...key, ...updates } : key,
        );
        persistKeys(keys);
        return {
          ...prev,
          keys,
        };
      });
    },
    [],
  );

  const clearKeyImageState = useCallback((keyId: number) => {
    setState((prev) => {
      const keys = prev.keys.map((key) => {
        if (key.id !== keyId) {
          return key;
        }

        const keyWithoutImage = { ...key };
        delete keyWithoutImage.image;
        delete keyWithoutImage.label;
        return keyWithoutImage;
      });

      persistKeys(keys);

      return {
        ...prev,
        keys,
      };
    });
  }, []);

  const selectKey = useCallback((keyId: number) => {
    setState((prev) => ({ ...prev, selectedKeyId: keyId }));
  }, []);

  const getKey = useCallback(
    (keyId: number) => state.keys.find((key) => key.id === keyId),
    [state.keys],
  );

  const value: StreamDeckContextType = {
    state,
    setConnected,
    updateKey,
    clearKeyImageState,
    selectKey,
    getKey,
  };

  return (
    <StreamDeckContext.Provider value={value}>
      {children}
    </StreamDeckContext.Provider>
  );
};

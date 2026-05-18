import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { StreamDeckContext } from "./StreamDeckReactContext";

export interface StreamDeckKey {
  id: number;
  row: number;
  column: number;
  image?: string;
  label?: string;
  action?: string;
}

export interface StreamDeckState {
  isConnected: boolean;
  keys: StreamDeckKey[];
  selectedKeyId: number | null;
}

export interface StreamDeckContextType {
  state: StreamDeckState;
  setConnected: (connected: boolean) => void;
  selectKey: (keyId: number) => void;
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

export const StreamDeckProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StreamDeckState>({
    isConnected: false,
    keys: initializeGrid(),
    selectedKeyId: null,
  });

  const setConnected = useCallback((connected: boolean) => {
    setState((prev) => ({ ...prev, isConnected: connected }));
  }, []);

  const selectKey = useCallback((keyId: number) => {
    setState((prev) => ({ ...prev, selectedKeyId: keyId }));
  }, []);

  const value: StreamDeckContextType = {
    state,
    setConnected,
    selectKey,
  };

  return (
    <StreamDeckContext.Provider value={value}>
      {children}
    </StreamDeckContext.Provider>
  );
};

import { useContext } from "react";
import type { StreamDeckContextType } from "./StreamDeckContext";
import { StreamDeckContext } from "./StreamDeckReactContext";

export const useStreamDeck = (): StreamDeckContextType => {
  const context = useContext(StreamDeckContext);
  if (!context) {
    throw new Error("useStreamDeck must be used within StreamDeckProvider");
  }
  return context;
};

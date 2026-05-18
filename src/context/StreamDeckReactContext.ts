import { createContext } from "react";
import type { StreamDeckContextType } from "./StreamDeckContext";

export const StreamDeckContext = createContext<
  StreamDeckContextType | undefined
>(undefined);

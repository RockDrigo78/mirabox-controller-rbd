import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { StreamDeckContext } from "./StreamDeckReactContext";
import type { StreamDeckKeyAction } from "../types/streamdeck";
import {
  createDefaultSideDisplayConfig,
  normalizeSideDisplayConfig,
  type SideDisplayConfig,
  type SideDisplayMode,
} from "../utils/sideDisplaySlots";

const STORAGE_KEY = "mirabox-controller:key-config:v1";
const KEY_ROW_COUNT = 3;
const KEY_COLUMN_COUNT = 5;

type StoredStreamDeckKey = {
  image?: string;
  label?: string;
  action?: StreamDeckKeyAction;
};

type StoredStreamDeckPage = {
  id: string;
  name: string;
  keys: Record<string, StoredStreamDeckKey>;
  sideDisplay?: SideDisplayConfig;
};

type StoredStreamDeckPayload = {
  version: 2;
  pages: StoredStreamDeckPage[];
  activePageIndex: number;
};

export interface StreamDeckKey {
  id: number;
  row: number;
  column: number;
  image?: string;
  label?: string;
  action?: StreamDeckKeyAction;
}

export interface StreamDeckPage {
  id: string;
  name: string;
  keys: StreamDeckKey[];
  sideDisplay: SideDisplayConfig;
}

export interface StreamDeckState {
  isConnected: boolean;
  pages: StreamDeckPage[];
  activePageIndex: number;
  keys: StreamDeckKey[];
  selectedKeyId: number | null;
}

export interface StreamDeckContextType {
  state: StreamDeckState;
  setConnected: (connected: boolean) => void;
  updateKey: (keyId: number, updates: Partial<StreamDeckKey>) => void;
  clearKeyImageState: (keyId: number) => void;
  clearKeyState: (keyId: number) => void;
  selectKey: (keyId: number) => void;
  getKey: (keyId: number) => StreamDeckKey | undefined;
  addPage: () => void;
  deleteCurrentPage: () => void;
  setSideDisplayMode: (mode: SideDisplayMode) => void;
  updateSideDisplayImage: (slotId: number, image: string | undefined) => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}

// Initialize grid with 5x3 = 15 keys (MiraBox HSV 293S layout)
const initializeGrid = (): StreamDeckKey[] => {
  const keys: StreamDeckKey[] = [];
  let id = 0;
  for (let row = 0; row < KEY_ROW_COUNT; row++) {
    for (let col = 0; col < KEY_COLUMN_COUNT; col++) {
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

const createPageId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `page-${Date.now()}`;
};

const createPage = (pageNumber: number, id = createPageId()): StreamDeckPage => ({
  id,
  name: `Page ${pageNumber}`,
  keys: initializeGrid(),
  sideDisplay: createDefaultSideDisplayConfig(),
});

const mergeStoredKeys = (
  baseKeys: StreamDeckKey[],
  storedKeys: Record<string, StoredStreamDeckKey>,
): StreamDeckKey[] =>
  baseKeys.map((key) => {
    const storedKey = storedKeys[String(key.id)];
    return storedKey ? { ...key, ...storedKey } : key;
  });

const getActiveKeys = (
  pages: StreamDeckPage[],
  activePageIndex: number,
): StreamDeckKey[] => pages[activePageIndex]?.keys ?? [];

const isStoredPayload = (value: unknown): value is StoredStreamDeckPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredStreamDeckPayload>;
  return candidate.version === 2 && Array.isArray(candidate.pages);
};

const restorePages = (): StreamDeckPage[] => {
  if (typeof window === "undefined") {
    return [createPage(1, "page-1")];
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return [createPage(1, "page-1")];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (isStoredPayload(parsedValue)) {
      const pages = parsedValue.pages.map((page) => ({
        id: page.id,
        name: page.name,
        keys: mergeStoredKeys(initializeGrid(), page.keys),
        sideDisplay: normalizeSideDisplayConfig(page.sideDisplay),
      }));

      return pages.length > 0 ? pages : [createPage(1, "page-1")];
    }

    const storedKeys = parsedValue as Record<string, StoredStreamDeckKey>;
    return [
      {
        ...createPage(1, "page-1"),
        keys: mergeStoredKeys(initializeGrid(), storedKeys),
      },
    ];
  } catch (error) {
    console.error("Failed to restore saved key configuration", error);
    return [createPage(1, "page-1")];
  }
};

const toStoredKeys = (keys: StreamDeckKey[]): Record<string, StoredStreamDeckKey> =>
  keys.reduce<Record<string, StoredStreamDeckKey>>((accumulator, key) => {
    const storedKey: StoredStreamDeckKey = {};
    if (key.image) {
      storedKey.image = key.image;
    }
    if (key.label) {
      storedKey.label = key.label;
    }
    if (key.action) {
      storedKey.action = key.action;
    }
    if (Object.keys(storedKey).length > 0) {
      accumulator[String(key.id)] = storedKey;
    }

    return accumulator;
  }, {});

const persistPages = (pages: StreamDeckPage[], activePageIndex: number) => {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredStreamDeckPayload = {
    version: 2,
    activePageIndex,
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      keys: toStoredKeys(page.keys),
      sideDisplay: page.sideDisplay,
    })),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const StreamDeckProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StreamDeckState>(() => {
    const restoredPages = restorePages();
    return {
      isConnected: false,
      pages: restoredPages,
      activePageIndex: 0,
      keys: getActiveKeys(restoredPages, 0),
      selectedKeyId: null,
    };
  });

  const setConnected = useCallback((connected: boolean) => {
    setState((prev) => ({ ...prev, isConnected: connected }));
  }, []);

  const updateKey = useCallback(
    (keyId: number, updates: Partial<StreamDeckKey>) => {
      setState((prev) => {
        const pages = prev.pages.map((page, pageIndex) => {
          if (pageIndex !== prev.activePageIndex) {
            return page;
          }

          return {
            ...page,
            keys: page.keys.map((key) => {
              if (key.id !== keyId) {
                return key;
              }

              const nextKey = { ...key, ...updates };
              if ("label" in updates && updates.label === undefined) {
                delete nextKey.label;
              }
              if ("image" in updates && updates.image === undefined) {
                delete nextKey.image;
              }
              if ("action" in updates && updates.action === undefined) {
                delete nextKey.action;
              }

              return nextKey;
            }),
          };
        });
        persistPages(pages, prev.activePageIndex);
        return {
          ...prev,
          pages,
          keys: getActiveKeys(pages, prev.activePageIndex),
        };
      });
    },
    [],
  );

  const clearKeyImageState = useCallback((keyId: number) => {
    setState((prev) => {
      const pages = prev.pages.map((page, pageIndex) => {
        if (pageIndex !== prev.activePageIndex) {
          return page;
        }

        return {
          ...page,
          keys: page.keys.map((key) => {
            if (key.id !== keyId) {
              return key;
            }

            const keyWithoutImage = { ...key };
            delete keyWithoutImage.image;
            return keyWithoutImage;
          }),
        };
      });

      persistPages(pages, prev.activePageIndex);

      return {
        ...prev,
        pages,
        keys: getActiveKeys(pages, prev.activePageIndex),
      };
    });
  }, []);

  const clearKeyState = useCallback((keyId: number) => {
    setState((prev) => {
      const pages = prev.pages.map((page, pageIndex) => {
        if (pageIndex !== prev.activePageIndex) {
          return page;
        }

        return {
          ...page,
          keys: page.keys.map((key) => {
            if (key.id !== keyId) {
              return key;
            }

            return {
              id: key.id,
              row: key.row,
              column: key.column,
            };
          }),
        };
      });

      persistPages(pages, prev.activePageIndex);

      return {
        ...prev,
        pages,
        keys: getActiveKeys(pages, prev.activePageIndex),
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

  const addPage = useCallback(() => {
    setState((prev) => {
      const pages = [...prev.pages, createPage(prev.pages.length + 1)];
      const activePageIndex = pages.length - 1;
      persistPages(pages, activePageIndex);

      return {
        ...prev,
        pages,
        activePageIndex,
        keys: getActiveKeys(pages, activePageIndex),
        selectedKeyId: null,
      };
    });
  }, []);

  const deleteCurrentPage = useCallback(() => {
    setState((prev) => {
      if (prev.pages.length <= 1) {
        return prev;
      }

      const pages = prev.pages.filter(
        (_page, pageIndex) => pageIndex !== prev.activePageIndex,
      );
      const activePageIndex = Math.min(prev.activePageIndex, pages.length - 1);
      persistPages(pages, activePageIndex);

      return {
        ...prev,
        pages,
        activePageIndex,
        keys: getActiveKeys(pages, activePageIndex),
        selectedKeyId: null,
      };
    });
  }, []);

  const setSideDisplayMode = useCallback((mode: SideDisplayMode) => {
    setState((prev) => {
      const pages = prev.pages.map((page, pageIndex) => {
        if (pageIndex !== prev.activePageIndex) {
          return page;
        }

        return {
          ...page,
          sideDisplay: {
            ...page.sideDisplay,
            mode,
          },
        };
      });
      persistPages(pages, prev.activePageIndex);

      return {
        ...prev,
        pages,
      };
    });
  }, []);

  const updateSideDisplayImage = useCallback(
    (slotId: number, image: string | undefined) => {
      setState((prev) => {
        const pages = prev.pages.map((page, pageIndex) => {
          if (pageIndex !== prev.activePageIndex) {
            return page;
          }

          return {
            ...page,
            sideDisplay: {
              ...page.sideDisplay,
              imageSlots: page.sideDisplay.imageSlots.map((slot) => {
                if (slot.id !== slotId) {
                  return slot;
                }

                return image ? { ...slot, image } : { id: slot.id };
              }),
            },
          };
        });
        persistPages(pages, prev.activePageIndex);

        return {
          ...prev,
          pages,
        };
      });
    },
    [],
  );

  const goToPreviousPage = useCallback(() => {
    setState((prev) => {
      const activePageIndex =
        prev.activePageIndex === 0
          ? prev.pages.length - 1
          : prev.activePageIndex - 1;
      persistPages(prev.pages, activePageIndex);

      return {
        ...prev,
        activePageIndex,
        keys: getActiveKeys(prev.pages, activePageIndex),
        selectedKeyId: null,
      };
    });
  }, []);

  const goToNextPage = useCallback(() => {
    setState((prev) => {
      const activePageIndex = (prev.activePageIndex + 1) % prev.pages.length;
      persistPages(prev.pages, activePageIndex);

      return {
        ...prev,
        activePageIndex,
        keys: getActiveKeys(prev.pages, activePageIndex),
        selectedKeyId: null,
      };
    });
  }, []);

  const value: StreamDeckContextType = {
    state,
    setConnected,
    updateKey,
    clearKeyImageState,
    clearKeyState,
    selectKey,
    getKey,
    addPage,
    deleteCurrentPage,
    setSideDisplayMode,
    updateSideDisplayImage,
    goToPreviousPage,
    goToNextPage,
  };

  return (
    <StreamDeckContext.Provider value={value}>
      {children}
    </StreamDeckContext.Provider>
  );
};

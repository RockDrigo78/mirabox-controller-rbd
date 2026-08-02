import type { ReactNode } from "react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { StreamDeckContext } from "./StreamDeckReactContext";
import type { StreamDeckKeyAction } from "../types/streamdeck";
import {
  createDefaultSideDisplayConfig,
  normalizeSideDisplayConfig,
  type SideDisplayConfig,
  type SideDisplayMode,
} from "../utils/sideDisplaySlots";

const STORAGE_KEY = "mirabox-controller:key-config:v1";
const PERSIST_DEBOUNCE_MS = 300;
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

type InternalStreamDeckState = Omit<StreamDeckState, "keys">;

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

const isStoredPayload = (value: unknown): value is StoredStreamDeckPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredStreamDeckPayload>;
  return candidate.version === 2 && Array.isArray(candidate.pages);
};

type RestoredStreamDeckState = {
  pages: StreamDeckPage[];
  activePageIndex: number;
};

const createDefaultRestoredState = (): RestoredStreamDeckState => ({
  pages: [createPage(1, "page-1")],
  activePageIndex: 0,
});

const restoreStoredState = (): RestoredStreamDeckState => {
  if (typeof window === "undefined") {
    return createDefaultRestoredState();
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return createDefaultRestoredState();
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

      if (pages.length === 0) {
        return createDefaultRestoredState();
      }

      const storedActivePageIndex = Number.isInteger(
        parsedValue.activePageIndex,
      )
        ? parsedValue.activePageIndex
        : 0;

      return {
        pages,
        activePageIndex: Math.min(
          Math.max(storedActivePageIndex, 0),
          pages.length - 1,
        ),
      };
    }

    const storedKeys = parsedValue as Record<string, StoredStreamDeckKey>;
    return {
      pages: [
        {
          ...createPage(1, "page-1"),
          keys: mergeStoredKeys(initializeGrid(), storedKeys),
        },
      ],
      activePageIndex: 0,
    };
  } catch (error) {
    console.error("Failed to restore saved key configuration", error);
    return createDefaultRestoredState();
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

const updateActivePage = (
  prev: InternalStreamDeckState,
  updatePage: (page: StreamDeckPage) => StreamDeckPage,
): InternalStreamDeckState => ({
  ...prev,
  pages: prev.pages.map((page, pageIndex) =>
    pageIndex === prev.activePageIndex ? updatePage(page) : page,
  ),
});

const updateKeyOnActivePage = (
  prev: InternalStreamDeckState,
  keyId: number,
  updateTargetKey: (key: StreamDeckKey) => StreamDeckKey,
): InternalStreamDeckState =>
  updateActivePage(prev, (page) => ({
    ...page,
    keys: page.keys.map((key) =>
      key.id === keyId ? updateTargetKey(key) : key,
    ),
  }));

export const StreamDeckProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<InternalStreamDeckState>(() => {
    const restoredState = restoreStoredState();
    return {
      isConnected: false,
      pages: restoredState.pages,
      activePageIndex: restoredState.activePageIndex,
      selectedKeyId: null,
    };
  });

  const latestPersistableStateRef = useRef({
    pages: state.pages,
    activePageIndex: state.activePageIndex,
  });

  // Debounce persistence: serializing every page image on each keystroke is expensive.
  useEffect(() => {
    latestPersistableStateRef.current = {
      pages: state.pages,
      activePageIndex: state.activePageIndex,
    };

    const persistTimeout = window.setTimeout(() => {
      persistPages(state.pages, state.activePageIndex);
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(persistTimeout);
    };
  }, [state.pages, state.activePageIndex]);

  useEffect(() => {
    const flushPersistence = () => {
      const { pages, activePageIndex } = latestPersistableStateRef.current;
      persistPages(pages, activePageIndex);
    };

    window.addEventListener("beforeunload", flushPersistence);
    return () => {
      window.removeEventListener("beforeunload", flushPersistence);
    };
  }, []);

  const setConnected = useCallback((connected: boolean) => {
    setState((prev) => ({ ...prev, isConnected: connected }));
  }, []);

  const updateKey = useCallback(
    (keyId: number, updates: Partial<StreamDeckKey>) => {
      setState((prev) =>
        updateKeyOnActivePage(prev, keyId, (key) => {
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
      );
    },
    [],
  );

  const clearKeyImageState = useCallback((keyId: number) => {
    setState((prev) =>
      updateKeyOnActivePage(prev, keyId, (key) => {
        const keyWithoutImage = { ...key };
        delete keyWithoutImage.image;
        return keyWithoutImage;
      }),
    );
  }, []);

  const clearKeyState = useCallback((keyId: number) => {
    setState((prev) =>
      updateKeyOnActivePage(prev, keyId, (key) => ({
        id: key.id,
        row: key.row,
        column: key.column,
      })),
    );
  }, []);

  const selectKey = useCallback((keyId: number) => {
    setState((prev) => ({ ...prev, selectedKeyId: keyId }));
  }, []);

  const addPage = useCallback(() => {
    setState((prev) => {
      const pages = [...prev.pages, createPage(prev.pages.length + 1)];

      return {
        ...prev,
        pages,
        activePageIndex: pages.length - 1,
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

      return {
        ...prev,
        pages,
        activePageIndex: Math.min(prev.activePageIndex, pages.length - 1),
        selectedKeyId: null,
      };
    });
  }, []);

  const setSideDisplayMode = useCallback((mode: SideDisplayMode) => {
    setState((prev) =>
      updateActivePage(prev, (page) => ({
        ...page,
        sideDisplay: {
          ...page.sideDisplay,
          mode,
        },
      })),
    );
  }, []);

  const updateSideDisplayImage = useCallback(
    (slotId: number, image: string | undefined) => {
      setState((prev) =>
        updateActivePage(prev, (page) => ({
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
        })),
      );
    },
    [],
  );

  const goToPreviousPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activePageIndex:
        prev.activePageIndex === 0
          ? prev.pages.length - 1
          : prev.activePageIndex - 1,
      selectedKeyId: null,
    }));
  }, []);

  const goToNextPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activePageIndex: (prev.activePageIndex + 1) % prev.pages.length,
      selectedKeyId: null,
    }));
  }, []);

  const activeKeys = useMemo(
    () => state.pages[state.activePageIndex]?.keys ?? [],
    [state.pages, state.activePageIndex],
  );

  const getKey = useCallback(
    (keyId: number) => activeKeys.find((key) => key.id === keyId),
    [activeKeys],
  );

  const value = useMemo<StreamDeckContextType>(
    () => ({
      state: { ...state, keys: activeKeys },
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
    }),
    [
      state,
      activeKeys,
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
    ],
  );

  return (
    <StreamDeckContext.Provider value={value}>
      {children}
    </StreamDeckContext.Provider>
  );
};

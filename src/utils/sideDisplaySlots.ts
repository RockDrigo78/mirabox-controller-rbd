export type SideDisplaySlot = {
  id: number;
  label?: string;
  image?: string;
};

export type SideDisplayMode = "page-info" | "custom-images";

export type SideDisplayImageSlot = {
  id: number;
  image?: string;
};

export type SideDisplayConfig = {
  mode: SideDisplayMode;
  imageSlots: SideDisplayImageSlot[];
};

export const SIDE_DISPLAY_KEY_ID_OFFSET = 15;
export const SIDE_DISPLAY_SLOT_COUNT = 3;

export const createSideDisplayImageSlots = (): SideDisplayImageSlot[] =>
  Array.from({ length: SIDE_DISPLAY_SLOT_COUNT }, (_value, slotIndex) => ({
    id: SIDE_DISPLAY_KEY_ID_OFFSET + slotIndex,
  }));

export const createDefaultSideDisplayConfig = (): SideDisplayConfig => ({
  mode: "page-info",
  imageSlots: createSideDisplayImageSlots(),
});

export const normalizeSideDisplayConfig = (
  config: Partial<SideDisplayConfig> | undefined,
): SideDisplayConfig => {
  const imageSlots = createSideDisplayImageSlots().map((slot) => {
    const storedSlot = config?.imageSlots?.find(
      (candidate) => candidate.id === slot.id,
    );
    return storedSlot?.image ? { ...slot, image: storedSlot.image } : slot;
  });

  return {
    mode: config?.mode === "custom-images" ? "custom-images" : "page-info",
    imageSlots,
  };
};

const getPageInfoSideDisplaySlots = (
  activePageIndex: number,
  pageCount: number,
): SideDisplaySlot[] => [
  {
    id: SIDE_DISPLAY_KEY_ID_OFFSET + 2,
    label: "Streamdeck",
  },
  {
    id: SIDE_DISPLAY_KEY_ID_OFFSET + 1,
    label: "Page",
  },
  {
    id: SIDE_DISPLAY_KEY_ID_OFFSET,
    label: `${activePageIndex + 1}/${pageCount}`,
  },
];

export const getSideDisplaySlots = (
  config: SideDisplayConfig,
  activePageIndex: number,
  pageCount: number,
): SideDisplaySlot[] => {
  if (config.mode === "custom-images") {
    return config.imageSlots
      .map((slot) => ({
        id: slot.id,
        image: slot.image,
      }))
      .reverse();
  }

  return getPageInfoSideDisplaySlots(activePageIndex, pageCount);
};

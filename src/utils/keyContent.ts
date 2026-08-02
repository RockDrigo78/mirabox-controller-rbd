import type { StreamDeckKey } from "../context/StreamDeckContext";

export const copyKeyContent = (
  key: StreamDeckKey,
  content: Pick<StreamDeckKey, "image" | "label" | "action">,
): StreamDeckKey => {
  const nextKey: StreamDeckKey = {
    id: key.id,
    row: key.row,
    column: key.column,
  };

  if (content.image !== undefined) {
    nextKey.image = content.image;
  }
  if (content.label !== undefined) {
    nextKey.label = content.label;
  }
  if (content.action !== undefined) {
    nextKey.action = content.action;
  }

  return nextKey;
};

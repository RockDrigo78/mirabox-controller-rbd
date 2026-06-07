import { useStreamDeck } from "../context/useStreamDeck";
import type { StreamDeckKey } from "../context/StreamDeckContext";
import { KeyLabelDisplay } from "./KeyLabelDisplay";
import { Box, Paper, Typography } from "@mui/material";
import { useState } from "react";

const KEY_CELL_SIZE_PX = 100;
const KEY_GRID_GAP_PX = 10;
const KEY_ROW_COUNT = 3;
const KEY_COLUMN_COUNT = 5;
const VERTICAL_SCREEN_WIDTH_PX = 64;
const DEVICE_PANEL_HEIGHT_PX =
  KEY_ROW_COUNT * KEY_CELL_SIZE_PX + (KEY_ROW_COUNT - 1) * KEY_GRID_GAP_PX;

const keyImageSx = {
  width: "100%",
  height: "100%",
  objectFit: "cover" as const,
  borderRadius: 1,
  display: "block",
};

export const StreamDeckGrid = () => {
  const { state, selectKey } = useStreamDeck();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${KEY_COLUMN_COUNT}, ${KEY_CELL_SIZE_PX}px)`,
          gridTemplateRows: `repeat(${KEY_ROW_COUNT}, ${KEY_CELL_SIZE_PX}px)`,
          gap: `${KEY_GRID_GAP_PX}px`,
          flexShrink: 0,
        }}
      >
        {state.keys.slice(0, 15).map((key: StreamDeckKey) => (
          <Paper
            key={key.id}
            onClick={() => selectKey(key.id)}
            onMouseEnter={() => setHoveredId(key.id)}
            onMouseLeave={() => setHoveredId(null)}
            sx={{
              aspectRatio: "1",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              p: 0.75,
              position: "relative",
              overflow: "hidden",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              border:
                state.selectedKeyId === key.id ? "3px solid" : "2px solid",
              borderColor:
                state.selectedKeyId === key.id ? "#58a6ff" : "#404050",
              background:
                state.selectedKeyId === key.id
                  ? "linear-gradient(135deg, #404050 0%, #2d2d44 100%)"
                  : "linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)",
              boxShadow:
                state.selectedKeyId === key.id
                  ? "0 0 12px rgba(88, 166, 255, 0.5), inset 0 0 6px rgba(88, 166, 255, 0.1)"
                  : hoveredId === key.id
                    ? "0 0 8px rgba(88, 166, 255, 0.3)"
                    : "0 2px 4px rgba(0, 0, 0, 0.3)",
              "&:hover": {
                borderColor: "#5a5a6a",
                boxShadow: "0 4px 14px rgba(88, 166, 255, 0.35)",
              },
            }}
          >
            {key.image ? (
              <Box
                component="img"
                src={key.image}
                alt={key.label || `Key ${key.id}`}
                sx={keyImageSx}
              />
            ) : key.label ? (
              <KeyLabelDisplay label={key.label} variant="standalone" />
            ) : (
              <Typography
                variant="h5"
                sx={{
                  fontWeight: "bold",
                  color: "#808080",
                }}
              >
                {key.id + 1}
              </Typography>
            )}
            {key.label && key.image ? (
              <KeyLabelDisplay label={key.label} variant="overlay" fontSize="10px" />
            ) : null}
          </Paper>
        ))}
      </Box>

      <Paper
        elevation={state.isConnected ? 0 : 3}
        sx={{
          width: VERTICAL_SCREEN_WIDTH_PX,
          height: DEVICE_PANEL_HEIGHT_PX,
          flexShrink: 0,
          background: state.isConnected
            ? "#000000"
            : "linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#808080",
        }}
      >
        {!state.isConnected ? (
          <Typography
            variant="caption"
            sx={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              letterSpacing: 1,
            }}
          >
            Screen
          </Typography>
        ) : null}
      </Paper>
    </Box>
  );
};

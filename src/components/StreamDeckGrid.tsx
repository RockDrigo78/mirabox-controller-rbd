import { useStreamDeck } from "../context/useStreamDeck";
import type { StreamDeckKey } from "../context/StreamDeckContext";
import { Box, Paper, Typography } from "@mui/material";
import { useState } from "react";

export const StreamDeckGrid = () => {
  const { state, selectKey } = useStreamDeck();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      {/* Button Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(5, 1fr)",
          gap: 2,
          flex: 2,
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
              p: 1,
              position: "relative",
              overflow: "hidden",
              transition: "all 0.2s ease",
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
                transform: "translateY(-2px)",
              },
            }}
          >
            {key.image ? (
              <Box
                component="img"
                src={key.image}
                alt={key.label || `Key ${key.id}`}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 1,
                }}
              />
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
            {key.label && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 2,
                  left: 2,
                  right: 2,
                  fontSize: "10px",
                  color: "#ddd",
                  background: "rgba(0, 0, 0, 0.6)",
                  p: 0.5,
                  borderRadius: 0.5,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {key.label}
              </Box>
            )}
          </Paper>
        ))}
      </Box>

      {!state.isConnected ? (
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            minWidth: 100,
            background: "linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#808080",
          }}
        >
          <Typography variant="h6">Vertical Screen</Typography>
        </Paper>
      ) : null}
    </Box>
  );
};

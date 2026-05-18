import { useState } from "react";
import { useStreamDeck } from "../context/useStreamDeck";

import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Devices as DevicesIcon } from "@mui/icons-material";

export const StatusBar = () => {
  const { state, setConnected } = useStreamDeck();
  const [connecting, setConnecting] = useState(false);
  const hasNativeBridge = Boolean(window.streamDockApi);

  const handleConnect = async () => {
    if (!hasNativeBridge) {
      setConnected(false);
      return;
    }

    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      setConnected(false);
      return;
    }

    setConnecting(true);
    try {
      if (state.isConnected) {
        await streamDockApi.disconnect();
        setConnected(false);
      } else {
        await streamDockApi.connect();

        for (const key of state.keys) {
          if (key.image) {
            await streamDockApi.setKeyImage(key.id, key.image);
          }
        }

        setConnected(true);
      }
    } catch (error) {
      console.error(error);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <DevicesIcon sx={{ mr: 2 }} />
        <Box sx={{ flex: 1, textAlign: "center" }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            MiraBox HSV 293S Controller
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Chip
            icon={<DevicesIcon />}
            label={
              hasNativeBridge
                ? state.isConnected
                  ? "Connected"
                  : "Disconnected"
                : "Browser Preview"
            }
            color={
              hasNativeBridge
                ? state.isConnected
                  ? "success"
                  : "error"
                : "warning"
            }
            variant="outlined"
          />
          <Button
            variant="contained"
            color={state.isConnected ? "error" : "success"}
            onClick={handleConnect}
            disabled={connecting || !hasNativeBridge}
            sx={{ minWidth: 120 }}
          >
            {connecting ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Connecting...
              </>
            ) : !hasNativeBridge ? (
              "Use Electron"
            ) : state.isConnected ? (
              "Disconnect"
            ) : (
              "Connect"
            )}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

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

  const handleConnect = async () => {
    setConnecting(true);
    try {
      if (!window.streamDockApi) {
        throw new Error(
          "Stream Dock API is only available when running inside Electron.",
        );
      }

      if (state.isConnected) {
        await window.streamDockApi.disconnect();
        setConnected(false);
      } else {
        await window.streamDockApi.connect();
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
            label={state.isConnected ? "Connected" : "Disconnected"}
            color={state.isConnected ? "success" : "error"}
            variant="outlined"
          />
          <Button
            variant="contained"
            color={state.isConnected ? "error" : "success"}
            onClick={handleConnect}
            disabled={connecting}
            sx={{ minWidth: 120 }}
          >
            {connecting ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Connecting...
              </>
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

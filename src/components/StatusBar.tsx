import { useEffect, useState } from "react";
import { useStreamDeck } from "../context/useStreamDeck";

import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import { Devices as DevicesIcon } from "@mui/icons-material";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to connect to the Stream Deck.";
};

export const StatusBar = () => {
  const { state, setConnected } = useStreamDeck();
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasNativeBridge = Boolean(window.streamDockApi);

  useEffect(() => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    return streamDockApi.onKeyActionError((message) => {
      setActionError(message);
    });
  }, []);

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
    setConnectionError(null);

    try {
      if (state.isConnected) {
        await streamDockApi.disconnect();
        setConnected(false);
      } else {
        await streamDockApi.connect();
        setConnected(true);

        for (const key of state.keys) {
          try {
            await streamDockApi.setKeyAction(key.id, key.action);
          } catch (syncError) {
            console.error(
              `Failed to sync action for key ${key.id + 1}`,
              syncError,
            );
            setConnectionError(
              `Connected, but key ${key.id + 1} action failed to sync. Re-save the action and reconnect.`,
            );
          }

          if (!key.image) {
            continue;
          }

          try {
            await streamDockApi.setKeyImage(key.id, key.image);
          } catch (syncError) {
            console.error(`Failed to sync key ${key.id + 1}`, syncError);
            setConnectionError(
              `Connected, but key ${key.id + 1} failed to upload. Re-select the key and upload again.`,
            );
          }
        }
      }
    } catch (error) {
      console.error(error);
      setConnected(false);
      setConnectionError(getErrorMessage(error));

      try {
        await streamDockApi.disconnect();
      } catch {
        // Ignore cleanup errors.
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
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
              onClick={() => void handleConnect()}
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

      <Snackbar
        open={connectionError !== null}
        autoHideDuration={8000}
        onClose={() => setConnectionError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          onClose={() => setConnectionError(null)}
          sx={{ width: "100%" }}
        >
          {connectionError}
        </Alert>
      </Snackbar>

      <Snackbar
        open={actionError !== null}
        autoHideDuration={8000}
        onClose={() => setActionError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          onClose={() => setActionError(null)}
          sx={{ width: "100%" }}
        >
          {actionError}
        </Alert>
      </Snackbar>
    </>
  );
};

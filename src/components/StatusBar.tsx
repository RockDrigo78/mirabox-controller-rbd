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
import {
  Devices as DevicesIcon,
  Usb as UsbIcon,
  UsbOff as UsbOffIcon,
} from "@mui/icons-material";

type StreamDockDevicePresence = {
  isAttached: boolean;
  productName?: string;
};

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
  const [devicePresence, setDevicePresence] =
    useState<StreamDockDevicePresence>({ isAttached: false });
  const hasNativeBridge = Boolean(window.streamDockApi);

  useEffect(() => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    void streamDockApi.getDevicePresence().then(setDevicePresence);

    const unsubscribePresence = streamDockApi.onDevicePresenceChanged(
      setDevicePresence,
    );
    const unsubscribeSessionEnded = streamDockApi.onSessionEnded(() => {
      setConnected(false);
      setConnectionError(
        "The MiraBox was unplugged or lost connection. Plug it back in and connect again.",
      );
    });
    const unsubscribeKeyActionError = streamDockApi.onKeyActionError(
      (message) => {
        setActionError(message);
      },
    );

    return () => {
      unsubscribePresence();
      unsubscribeSessionEnded();
      unsubscribeKeyActionError();
    };
  }, [setConnected]);

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

          if (!key.image && !key.label) {
            continue;
          }

          try {
            await streamDockApi.setKeyImage(
              key.id,
              key.image ?? "",
              key.label,
            );
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
            {hasNativeBridge ? (
              <Chip
                icon={devicePresence.isAttached ? <UsbIcon /> : <UsbOffIcon />}
                label={
                  devicePresence.isAttached
                    ? devicePresence.productName
                      ? `${devicePresence.productName} detected`
                      : "Device detected"
                    : "No device"
                }
                color={devicePresence.isAttached ? "success" : "default"}
                variant="outlined"
              />
            ) : null}
            <Chip
              icon={<DevicesIcon />}
              label={
                hasNativeBridge
                  ? state.isConnected
                    ? "App connected"
                    : "App disconnected"
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
              disabled={
                connecting || !hasNativeBridge || !devicePresence.isAttached
              }
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

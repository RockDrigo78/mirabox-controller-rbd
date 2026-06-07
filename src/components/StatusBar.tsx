import { useEffect, useRef, useState } from "react";
import { useStreamDeck } from "../context/useStreamDeck";
import type { StreamDeckKey } from "../context/StreamDeckContext";

import {
  AppBar,
  Toolbar,
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

const appLogoSource = `${import.meta.env.BASE_URL}assets/Controller-logo-03.png`;

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

const syncKeysToNative = async (
  streamDockApi: NonNullable<typeof window.streamDockApi>,
  keys: StreamDeckKey[],
) => {
  for (const key of keys) {
    await streamDockApi.setKeyAction(key.id, key.action);

    if (!key.image && !key.label?.trim()) {
      await streamDockApi.clearKeyImage(key.id);
      continue;
    }

    await streamDockApi.setKeyImage(key.id, key.image ?? "", key.label);
  }
};

export const StatusBar = () => {
  const { state, setConnected, goToPreviousPage, goToNextPage } =
    useStreamDeck();
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [devicePresence, setDevicePresence] =
    useState<StreamDockDevicePresence>({ isAttached: false });
  const previousSyncedPageIndexRef = useRef(state.activePageIndex);
  const hasNativeBridge = Boolean(window.streamDockApi);

  useEffect(() => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    void streamDockApi.getDevicePresence().then(setDevicePresence);

    const unsubscribePresence =
      streamDockApi.onDevicePresenceChanged(setDevicePresence);
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
    const unsubscribePageNavigation = streamDockApi.onPageNavigation(
      (direction) => {
        if (direction === "previous") {
          goToPreviousPage();
          return;
        }

        goToNextPage();
      },
    );

    return () => {
      unsubscribePresence();
      unsubscribeSessionEnded();
      unsubscribeKeyActionError();
      unsubscribePageNavigation();
    };
  }, [goToNextPage, goToPreviousPage, setConnected]);

  useEffect(() => {
    if (!state.isConnected) {
      previousSyncedPageIndexRef.current = state.activePageIndex;
      return;
    }

    if (previousSyncedPageIndexRef.current === state.activePageIndex) {
      return;
    }

    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    previousSyncedPageIndexRef.current = state.activePageIndex;
    void syncKeysToNative(streamDockApi, state.keys).catch((error: unknown) => {
      console.error(error);
      setActionError("Failed to sync the selected page to the MiraBox.");
    });
  }, [state.activePageIndex, state.isConnected, state.keys]);

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
        previousSyncedPageIndexRef.current = state.activePageIndex;
        await syncKeysToNative(streamDockApi, state.keys);
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
        <Toolbar sx={{ minHeight: 88, py: 1 }}>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <Box
              component="img"
              src={appLogoSource}
              alt="MiraBox HSV 293S Controller"
              sx={{
                height: 64,
                maxWidth: "min(420px, 45vw)",
                borderRadius: 1,
                objectFit: "contain",
              }}
            />
          </Box>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
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
        autoHideDuration={6000}
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
        autoHideDuration={6000}
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

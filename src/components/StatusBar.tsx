import { useCallback, useEffect, useRef, useState } from "react";
import { useStreamDeck } from "../context/useStreamDeck";
import type {
  StreamDeckKey,
  StreamDeckPage,
} from "../context/StreamDeckContext";
import { getSideDisplaySlots } from "../utils/sideDisplaySlots";

import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Snackbar,
  Alert,
  Switch,
  Typography,
} from "@mui/material";
import {
  Devices as DevicesIcon,
  Settings as SettingsIcon,
  Usb as UsbIcon,
  UsbOff as UsbOffIcon,
} from "@mui/icons-material";

const appLogoSource = `${import.meta.env.BASE_URL}assets/Controller-logo-03.png`;

type StreamDockDevicePresence = {
  isAttached: boolean;
  productName?: string;
};

type AppSettings = {
  startWithWindows: boolean;
  hideToTray: boolean;
};

const defaultAppSettings: AppSettings = {
  startWithWindows: false,
  hideToTray: false,
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

const syncSideDisplaySlotsToNative = async (
  streamDockApi: NonNullable<typeof window.streamDockApi>,
  activePage: StreamDeckPage | undefined,
  activePageIndex: number,
  pageCount: number,
  sideDisplayKeyCount: number,
) => {
  if (!activePage) {
    return;
  }

  const sideDisplaySlots = getSideDisplaySlots(
    activePage.sideDisplay,
    activePageIndex,
    pageCount,
  ).slice(0, sideDisplayKeyCount);

  for (const slot of sideDisplaySlots) {
    if (!slot.image && !slot.label?.trim()) {
      await streamDockApi.clearKeyImage(slot.id);
      continue;
    }

    await streamDockApi.setKeyImage(slot.id, slot.image ?? "", slot.label);
  }
};

const getDisplaySyncSignature = (
  activePage: StreamDeckPage | undefined,
  pageCount: number,
): string => {
  if (!activePage) {
    return `unknown:${pageCount}`;
  }

  const sideDisplayImages = activePage.sideDisplay.imageSlots
    .map((slot) => `${slot.id}:${slot.image ?? ""}`)
    .join(",");

  return [
    activePage.id,
    pageCount,
    activePage.sideDisplay.mode,
    sideDisplayImages,
  ].join(":");
};

const getPresenceSignature = (presence: StreamDockDevicePresence): string =>
  `${presence.isAttached}:${presence.productName ?? ""}`;

export const StatusBar = () => {
  const { state, setConnected, goToPreviousPage, goToNextPage } =
    useStreamDeck();
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [devicePresence, setDevicePresence] =
    useState<StreamDockDevicePresence>({ isAttached: false });
  const [appSettings, setAppSettings] =
    useState<AppSettings>(defaultAppSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const sideDisplayKeyCountRef = useRef(0);
  const userDisconnectedRef = useRef(false);
  const streamDeckStateRef = useRef(state);
  useEffect(() => {
    streamDeckStateRef.current = state;
  }, [state]);
  const lastAutoConnectPresenceSignatureRef = useRef<string | null>(null);
  const previousDisplaySyncSignatureRef = useRef(
    getDisplaySyncSignature(
      state.pages[state.activePageIndex],
      state.pages.length,
    ),
  );
  const hasNativeBridge = Boolean(window.streamDockApi);

  const resyncConnectedDisplay = useCallback(async () => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    const currentState = streamDeckStateRef.current;
    if (!currentState.isConnected) {
      return;
    }

    try {
      await syncKeysToNative(streamDockApi, currentState.keys);
      await syncSideDisplaySlotsToNative(
        streamDockApi,
        currentState.pages[currentState.activePageIndex],
        currentState.activePageIndex,
        currentState.pages.length,
        sideDisplayKeyCountRef.current,
      );
      previousDisplaySyncSignatureRef.current = getDisplaySyncSignature(
        currentState.pages[currentState.activePageIndex],
        currentState.pages.length,
      );
    } catch (error) {
      console.error(error);
      setActionError("Failed to restore the MiraBox display after wake.");
    }
  }, []);

  const connectToDevice = useCallback(async () => {
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
      const connectionInfo = await streamDockApi.connect();
      sideDisplayKeyCountRef.current = connectionInfo.sideDisplayKeyCount;
      setConnected(true);
      previousDisplaySyncSignatureRef.current = getDisplaySyncSignature(
        state.pages[state.activePageIndex],
        state.pages.length,
      );
      await syncKeysToNative(streamDockApi, state.keys);
      await syncSideDisplaySlotsToNative(
        streamDockApi,
        state.pages[state.activePageIndex],
        state.activePageIndex,
        state.pages.length,
        connectionInfo.sideDisplayKeyCount,
      );
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
  }, [
    hasNativeBridge,
    setConnected,
    state.activePageIndex,
    state.keys,
    state.pages,
  ]);

  useEffect(() => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    void streamDockApi.getDevicePresence().then(setDevicePresence);
    void streamDockApi.getAppSettings().then(setAppSettings).catch((error) => {
      console.error(error);
      setActionError("Failed to load app settings.");
    });

    const unsubscribeSettingsChanged =
      streamDockApi.onAppSettingsChanged(setAppSettings);
    const unsubscribePresence =
      streamDockApi.onDevicePresenceChanged(setDevicePresence);
    const unsubscribeSessionEnded = streamDockApi.onSessionEnded(() => {
      setConnected(false);
      setConnectionError(
        "The MiraBox was unplugged or lost connection. Plug it back in and connect again.",
      );
    });
    const unsubscribeConnectionRestored = streamDockApi.onConnectionRestored(
      () => {
        void resyncConnectedDisplay();
      },
    );
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
      unsubscribeSettingsChanged();
      unsubscribePresence();
      unsubscribeSessionEnded();
      unsubscribeConnectionRestored();
      unsubscribeKeyActionError();
      unsubscribePageNavigation();
    };
  }, [goToNextPage, goToPreviousPage, resyncConnectedDisplay, setConnected]);

  useEffect(() => {
    const displaySyncSignature = getDisplaySyncSignature(
      state.pages[state.activePageIndex],
      state.pages.length,
    );

    if (!state.isConnected) {
      previousDisplaySyncSignatureRef.current = displaySyncSignature;
      return;
    }

    if (previousDisplaySyncSignatureRef.current === displaySyncSignature) {
      return;
    }

    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    previousDisplaySyncSignatureRef.current = displaySyncSignature;
    void (async () => {
      await syncKeysToNative(streamDockApi, state.keys);
      await syncSideDisplaySlotsToNative(
        streamDockApi,
        state.pages[state.activePageIndex],
        state.activePageIndex,
        state.pages.length,
        sideDisplayKeyCountRef.current,
      );
    })().catch((error: unknown) => {
      console.error(error);
      setActionError("Failed to sync the selected page to the MiraBox.");
    });
  }, [state.activePageIndex, state.isConnected, state.keys, state.pages]);

  useEffect(() => {
    if (
      !hasNativeBridge ||
      connecting ||
      state.isConnected ||
      userDisconnectedRef.current
    ) {
      return;
    }

    if (!devicePresence.isAttached) {
      lastAutoConnectPresenceSignatureRef.current = null;
      return;
    }

    const presenceSignature = getPresenceSignature(devicePresence);
    if (lastAutoConnectPresenceSignatureRef.current === presenceSignature) {
      return;
    }

    lastAutoConnectPresenceSignatureRef.current = presenceSignature;
    void connectToDevice();
  }, [
    connectToDevice,
    connecting,
    devicePresence,
    hasNativeBridge,
    state.isConnected,
  ]);

  const handleConnect = async () => {
    const streamDockApi = window.streamDockApi;
    if (!hasNativeBridge || !streamDockApi) {
      setConnected(false);
      return;
    }

    if (state.isConnected) {
      userDisconnectedRef.current = true;
      setConnecting(true);
      setConnectionError(null);

      try {
        await streamDockApi.disconnect();
        sideDisplayKeyCountRef.current = 0;
        setConnected(false);
      } catch (error) {
        console.error(error);
        setConnectionError(getErrorMessage(error));
      } finally {
        setConnecting(false);
      }
      return;
    }

    userDisconnectedRef.current = false;
    lastAutoConnectPresenceSignatureRef.current = null;
    await connectToDevice();
  };

  const handleUpdateAppSettings = async (updates: Partial<AppSettings>) => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    try {
      const nextSettings = await streamDockApi.updateAppSettings(updates);
      setAppSettings(nextSettings);
    } catch (error) {
      console.error(error);
      setActionError("Failed to save app settings.");
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
                connecting ||
                !hasNativeBridge ||
                (!state.isConnected && !devicePresence.isAttached)
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
            {hasNativeBridge ? (
              <IconButton
                color="inherit"
                aria-label="Open app settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon />
              </IconButton>
            ) : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Dialog open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <DialogTitle>App Settings</DialogTitle>
        <DialogContent sx={{ minWidth: 360 }}>
          <FormControlLabel
            control={
              <Switch
                checked={appSettings.startWithWindows}
                onChange={(event) =>
                  void handleUpdateAppSettings({
                    startWithWindows: event.target.checked,
                  })
                }
              />
            }
            label="Start with Windows"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Launch MiraBox Controller automatically when you sign in.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={appSettings.hideToTray}
                onChange={(event) =>
                  void handleUpdateAppSettings({
                    hideToTray: event.target.checked,
                  })
                }
              />
            }
            label="Keep running in the system tray"
          />
          <Typography variant="body2" color="text.secondary">
            Closing the window hides the app to the tray instead of quitting.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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

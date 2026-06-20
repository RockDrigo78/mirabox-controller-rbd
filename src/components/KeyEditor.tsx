import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Image as ImageIcon,
  Launch as LaunchIcon,
} from "@mui/icons-material";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);
import { KeyLabelDisplay } from "./KeyLabelDisplay";
import { useStreamDeck } from "../context/useStreamDeck";
import type {
  StreamDeckKeyAction,
  StreamDeckKeyActionType,
} from "../types/streamdeck";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to update the Stream Deck key image.";
};

const isWindows =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

export const KeyEditor = () => {
  const {
    state,
    getKey,
    updateKey,
    clearKeyImageState,
    clearKeyState,
    goToPreviousPage,
    goToNextPage,
  } = useStreamDeck();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isDeleteKeyDialogOpen, setIsDeleteKeyDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const isConnectedRef = useRef(state.isConnected);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyImageSyncGenerationRef = useRef(0);
  const labelSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    isConnectedRef.current = state.isConnected;
  }, [state.isConnected]);

  useEffect(
    () => () => {
      if (labelSyncTimeoutRef.current) {
        clearTimeout(labelSyncTimeoutRef.current);
      }
    },
    [],
  );

  const syncKeyImageToNative = (
    keyId: number,
    imageDataUrl: string | undefined,
    label: string | undefined,
    syncGeneration: number,
  ) => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi || !isConnectedRef.current) {
      return;
    }

    void (async () => {
      try {
        if (keyImageSyncGenerationRef.current !== syncGeneration) {
          return;
        }

        if (!imageDataUrl && !label?.trim()) {
          await streamDockApi.clearKeyImage(keyId);
          return;
        }

        await streamDockApi.setKeyImage(keyId, imageDataUrl ?? "", label);

        if (keyImageSyncGenerationRef.current !== syncGeneration) {
          return;
        }
      } catch (error) {
        if (keyImageSyncGenerationRef.current !== syncGeneration) {
          return;
        }

        console.error(error);
        setUploadError(getErrorMessage(error));
      }
    })();
  };

  const queueLabelSyncToNative = (
    keyId: number,
    imageDataUrl: string | undefined,
    label: string | undefined,
  ) => {
    if (labelSyncTimeoutRef.current) {
      clearTimeout(labelSyncTimeoutRef.current);
      labelSyncTimeoutRef.current = null;
    }

    keyImageSyncGenerationRef.current += 1;

    if (!label?.trim()) {
      const syncGeneration = keyImageSyncGenerationRef.current;
      syncKeyImageToNative(keyId, imageDataUrl, undefined, syncGeneration);
      return;
    }

    const syncGeneration = keyImageSyncGenerationRef.current;
    labelSyncTimeoutRef.current = setTimeout(() => {
      labelSyncTimeoutRef.current = null;
      if (keyImageSyncGenerationRef.current !== syncGeneration) {
        return;
      }

      syncKeyImageToNative(keyId, imageDataUrl, label, syncGeneration);
    }, 250);
  };

  const syncActionToNative = (keyId: number, action?: StreamDeckKeyAction) => {
    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    void streamDockApi.setKeyAction(keyId, action).catch((error) => {
      console.error(error);
      setActionMessage(getErrorMessage(error));
    });
  };

  const updateKeyAction = (keyId: number, updates?: StreamDeckKeyAction) => {
    setActionMessage(null);
    updateKey(keyId, { action: updates });
    syncActionToNative(keyId, updates);
  };

  if (state.selectedKeyId === null) {
    return (
      <Card sx={{ height: "100%", overflow: "auto" }}>
        <CardHeader
          title="Key Editor"
          subheader="Select a key to configure it"
        />
        <CardContent>
          <Alert severity="info">
            Select one of the 15 keys, then drag an image onto the preview or
            click it to choose a file.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const key = getKey(state.selectedKeyId);
  if (!key) {
    return null;
  }

  const processImageFile = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setUploadError("Use a PNG, JPG, GIF, or WebP image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      void (async () => {
        const rawImageData = loadEvent.target?.result;
        if (typeof rawImageData !== "string") {
          return;
        }

        setUploadError(null);

        const streamDockApi = window.streamDockApi;
        const isGif = file.type === "image/gif";

        let previewImageData = rawImageData;
        const nextLabel = file.name.replace(/\.[^.]+$/, "");

        if (streamDockApi && !isGif) {
          try {
            previewImageData =
              await streamDockApi.preprocessKeyImage(rawImageData);
          } catch (error) {
            console.error(error);
            setUploadError(getErrorMessage(error));
            return;
          }
        }

        updateKey(key.id, {
          image: previewImageData,
          label: nextLabel,
        });

        if (!isConnectedRef.current || !streamDockApi) {
          return;
        }

        try {
          await streamDockApi.setKeyImage(key.id, rawImageData, nextLabel);
        } catch (error) {
          console.error(error);
          setUploadError(getErrorMessage(error));
        }
      })();
    };

    reader.readAsDataURL(file);
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImageFile(file);
    }

    event.target.value = "";
  };

  const openImageFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    const keyIdToClear = state.selectedKeyId;
    if (keyIdToClear === null) {
      return;
    }

    void (async () => {
      setUploadError(null);
      const labelToKeep = key.label;
      clearKeyImageState(keyIdToClear);

      const streamDockApi = window.streamDockApi;
      if (!isConnectedRef.current || !streamDockApi) {
        return;
      }

      if (labelToKeep?.trim()) {
        syncKeyImageToNative(
          keyIdToClear,
          undefined,
          labelToKeep,
          ++keyImageSyncGenerationRef.current,
        );
        return;
      }

      try {
        await streamDockApi.clearKeyImage(keyIdToClear);
      } catch (error) {
        console.error(error);
        setUploadError(getErrorMessage(error));
      }
    })();
  };

  const handleConfirmDeleteKey = () => {
    const keyIdToDelete = state.selectedKeyId;
    if (keyIdToDelete === null) {
      return;
    }

    setIsDeleteKeyDialogOpen(false);
    setUploadError(null);
    setActionMessage(null);

    if (labelSyncTimeoutRef.current) {
      clearTimeout(labelSyncTimeoutRef.current);
      labelSyncTimeoutRef.current = null;
    }

    keyImageSyncGenerationRef.current += 1;
    clearKeyState(keyIdToDelete);

    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      return;
    }

    void (async () => {
      if (!isConnectedRef.current) {
        return;
      }

      try {
        await streamDockApi.clearKeyImage(keyIdToDelete);
        await streamDockApi.setKeyAction(keyIdToDelete, undefined);
      } catch (error) {
        console.error(error);
        setUploadError(getErrorMessage(error));
      }
    })();
  };

  const action = key.action;
  const actionType: StreamDeckKeyActionType = action?.type ?? "none";
  const hasKeyContent = Boolean(
    key.image ||
      key.label?.trim() ||
      (action && action.type !== "none"),
  );

  const handleActionTypeChange = (nextType: StreamDeckKeyActionType) => {
    if (nextType === "none") {
      updateKeyAction(key.id, undefined);
      return;
    }

    updateKeyAction(key.id, { type: nextType });
  };

  const updateActionField = <K extends keyof StreamDeckKeyAction>(
    field: K,
    value: StreamDeckKeyAction[K],
  ) => {
    const nextAction: StreamDeckKeyAction = {
      ...(action ?? { type: actionType }),
      [field]: value,
    };
    updateKeyAction(key.id, nextAction);
  };

  const handleTestAction = () => {
    if (!action || action.type === "none") {
      setActionMessage("Configure an action before testing it.");
      return;
    }

    if (action.type === "previous-page") {
      goToPreviousPage();
      return;
    }

    if (action.type === "next-page") {
      goToNextPage();
      return;
    }

    const streamDockApi = window.streamDockApi;
    if (!streamDockApi) {
      setActionMessage("Action testing is only available in the Electron app.");
      return;
    }

    setActionMessage(null);
    void streamDockApi
      .executeKeyAction(action)
      .then(() => {
        setActionMessage("Action executed.");
      })
      .catch((error) => {
        console.error(error);
        setActionMessage(getErrorMessage(error));
      });
  };

  return (
    <Card
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardHeader
        title={`Key ${key.id + 1}`}
        subheader="Drag and drop or click the preview to add an image"
      />
      <CardContent
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <TextField
          label="Display label"
          value={key.label ?? ""}
          onChange={(event) => {
            const rawLabel = event.target.value;
            const nextLabel =
              rawLabel.trim() === "" ? undefined : rawLabel;
            updateKey(key.id, { label: nextLabel });
            queueLabelSyncToNative(key.id, key.image, nextLabel);
          }}
          helperText="Burned into the key image on the device when connected."
        />

        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={handleImageUpload}
        />

        <Paper
          variant="outlined"
          onClick={openImageFilePicker}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node)) {
              return;
            }

            setIsDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            const file = event.dataTransfer.files[0];
            if (file) {
              processImageFile(file);
            }
          }}
          sx={{
            width: "100%",
            flexShrink: 0,
            aspectRatio: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            bgcolor: isDragOver ? "action.hover" : "background.default",
            position: "relative",
            cursor: "pointer",
            borderStyle: isDragOver ? "dashed" : "solid",
            borderColor: isDragOver ? "primary.main" : undefined,
            transition: "background-color 0.15s ease, border-color 0.15s ease",
          }}
        >
          {key.image ? (
            <Box
              component="img"
              src={key.image}
              alt={key.label || `Key ${key.id + 1}`}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                pointerEvents: "none",
              }}
            />
          ) : key.label ? (
            <KeyLabelDisplay label={key.label} variant="standalone" />
          ) : (
            <Box
              sx={{
                textAlign: "center",
                color: "text.secondary",
                pointerEvents: "none",
                px: 2,
              }}
            >
              <ImageIcon sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="body2">
                {isDragOver
                  ? "Drop image here"
                  : "Drag and drop an image, or click to browse"}
              </Typography>
            </Box>
          )}
          {key.label && key.image ? (
            <KeyLabelDisplay label={key.label} variant="overlay" />
          ) : null}
        </Paper>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleClear}
          disabled={!key.image}
        >
          Clear Key Image
        </Button>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setIsDeleteKeyDialogOpen(true)}
          disabled={!hasKeyContent}
        >
          Delete Key
        </Button>

        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="key-action-type-label">Action</InputLabel>
            <Select
              labelId="key-action-type-label"
              label="Action"
              value={actionType}
              onChange={(event) =>
                handleActionTypeChange(
                  event.target.value as StreamDeckKeyActionType,
                )
              }
            >
              <MenuItem value="none">No action</MenuItem>
              <MenuItem value="launch-app">Launch application</MenuItem>
              <MenuItem value="open-url">Open URL</MenuItem>
              <MenuItem value="shell-command">Run shell command</MenuItem>
              <MenuItem value="previous-page">Previous page</MenuItem>
              <MenuItem value="next-page">Next page</MenuItem>
            </Select>
          </FormControl>

          {actionType === "launch-app" ? (
            <>
              <TextField
                label="Executable path"
                value={action?.path ?? ""}
                onChange={(event) =>
                  updateActionField("path", event.target.value)
                }
                placeholder="C:\\Program Files\\App\\app.exe"
              />
              <TextField
                label="Arguments"
                value={action?.args ?? ""}
                onChange={(event) =>
                  updateActionField("args", event.target.value)
                }
                helperText="Optional. Quotes are supported for paths with spaces."
              />
              <TextField
                label="Working directory"
                value={action?.workingDirectory ?? ""}
                onChange={(event) =>
                  updateActionField("workingDirectory", event.target.value)
                }
                helperText="Optional. Defaults to the executable folder."
              />
            </>
          ) : null}

          {actionType === "open-url" ? (
            <TextField
              label="URL"
              value={action?.url ?? ""}
              onChange={(event) => updateActionField("url", event.target.value)}
              placeholder="https://example.com"
            />
          ) : null}

          {actionType === "shell-command" ? (
            <>
              <TextField
                label="Command"
                value={action?.command ?? ""}
                onChange={(event) =>
                  updateActionField("command", event.target.value)
                }
                placeholder={isWindows ? "start notepad" : "open -a Notes"}
              />
              <TextField
                label="Working directory"
                value={action?.workingDirectory ?? ""}
                onChange={(event) =>
                  updateActionField("workingDirectory", event.target.value)
                }
                helperText="Optional. Defaults to your home directory."
              />
            </>
          ) : null}

          <Button
            variant="outlined"
            startIcon={<LaunchIcon />}
            onClick={handleTestAction}
            disabled={actionType === "none"}
          >
            Test Action
          </Button>
        </Stack>

        {uploadError ? <Alert severity="error">{uploadError}</Alert> : null}
        {actionMessage ? (
          <Alert
            severity={actionMessage === "Action executed." ? "success" : "info"}
          >
            {actionMessage}
          </Alert>
        ) : null}

        <Alert severity={state.isConnected ? "success" : "warning"}>
          {state.isConnected
            ? "Images sync to the device immediately, and programmed actions run when the hardware key is pressed."
            : "Images and actions are saved locally and will sync on the next connection."}
        </Alert>
      </CardContent>

      <Dialog
        open={isDeleteKeyDialogOpen}
        onClose={() => setIsDeleteKeyDialogOpen(false)}
      >
        <DialogTitle>Delete Key?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will remove the image, label, and action from key {key.id + 1}.
            This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteKeyDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeleteKey}
          >
            Delete Key
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

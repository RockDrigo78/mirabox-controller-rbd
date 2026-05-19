import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
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
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
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
  const { state, getKey, updateKey, clearKeyImageState } = useStreamDeck();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const isConnectedRef = useRef(state.isConnected);

  useEffect(() => {
    isConnectedRef.current = state.isConnected;
  }, [state.isConnected]);

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
      <Card sx={{ height: "100%" }}>
        <CardHeader
          title="Key Editor"
          subheader="Select a key to configure it"
        />
        <CardContent>
          <Alert severity="info">
            Select one of the 15 keys, then upload a PNG, JPG, or GIF.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const key = getKey(state.selectedKeyId);
  if (!key) {
    return null;
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
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
          label: file.name.replace(/\.[^.]+$/, ""),
        });

        if (!isConnectedRef.current || !streamDockApi) {
          return;
        }

        try {
          await streamDockApi.setKeyImage(key.id, rawImageData);
        } catch (error) {
          console.error(error);
          setUploadError(getErrorMessage(error));
        }
      })();
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleClear = () => {
    const keyIdToClear = state.selectedKeyId;
    if (keyIdToClear === null) {
      return;
    }

    void (async () => {
      setUploadError(null);
      clearKeyImageState(keyIdToClear);

      const streamDockApi = window.streamDockApi;
      if (!isConnectedRef.current || !streamDockApi) {
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

  const action = key.action;
  const actionType: StreamDeckKeyActionType = action?.type ?? "none";

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
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader
        title={`Key ${key.id + 1}`}
        subheader="Images are cropped to a square (cover fit) before upload"
      />
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Display label"
          value={key.label ?? ""}
          onChange={(event) =>
            updateKey(key.id, { label: event.target.value || undefined })
          }
          helperText="Shown on the key preview and on the device overlay."
        />

        <Paper
          variant="outlined"
          sx={{
            aspectRatio: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            bgcolor: "background.default",
          }}
        >
          {key.image ? (
            <Box
              component="img"
              src={key.image}
              alt={key.label || `Key ${key.id + 1}`}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Box sx={{ textAlign: "center", color: "text.secondary" }}>
              <ImageIcon sx={{ fontSize: 48, mb: 1 }} />
              <Typography>No image assigned</Typography>
            </Box>
          )}
        </Paper>

        <Button
          component="label"
          variant="contained"
          startIcon={<UploadFileIcon />}
        >
          Upload Image or GIF
          <input
            hidden
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            onChange={handleImageUpload}
          />
        </Button>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleClear}
          disabled={!key.image}
        >
          Clear Key Image
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
    </Card>
  );
};

import { useRef, useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Typography,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Image as ImageIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import { useStreamDeck } from "../context/useStreamDeck";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to update the Stream Deck key image.";
};

export const KeyEditor = () => {
  const { state, getKey, updateKey, clearKeyImageState } = useStreamDeck();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isConnectedRef = useRef(state.isConnected);
  isConnectedRef.current = state.isConnected;

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
            previewImageData = await streamDockApi.preprocessKeyImage(rawImageData);
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

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader
        title={`Key ${key.id + 1}`}
        subheader="Images are cropped to a square (cover fit) before upload"
      />
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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

        {uploadError ? <Alert severity="error">{uploadError}</Alert> : null}

        <Alert severity={state.isConnected ? "success" : "warning"}>
          {state.isConnected
            ? "Images are preprocessed to a square cover crop, then sent to the device."
            : "Images are preprocessed when selected and will upload on the next connection."}
        </Alert>
      </CardContent>
    </Card>
  );
};

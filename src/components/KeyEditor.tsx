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
  const { state, getKey, updateKey } = useStreamDeck();
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
        const imageData = loadEvent.target?.result;
        if (typeof imageData !== "string") {
          return;
        }

        setUploadError(null);

        updateKey(key.id, {
          image: imageData,
          label: file.name.replace(/\.[^.]+$/, ""),
        });

        const streamDockApi = window.streamDockApi;
        if (!isConnectedRef.current || !streamDockApi) {
          return;
        }

        try {
          await streamDockApi.setKeyImage(key.id, imageData);
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
    void (async () => {
      setUploadError(null);
      updateKey(key.id, { image: undefined, label: undefined });

      const streamDockApi = window.streamDockApi;
      if (!isConnectedRef.current || !streamDockApi) {
        return;
      }

      try {
        await streamDockApi.clearKeyImage(key.id);
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
        subheader="Upload an image or animated GIF"
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
            ? "Uploads are sent to the connected MiraBox immediately."
            : "You can prepare images while disconnected. They will upload on the next connection."}
        </Alert>
      </CardContent>
    </Card>
  );
};

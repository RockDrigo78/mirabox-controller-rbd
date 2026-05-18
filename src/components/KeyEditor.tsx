import type { ChangeEvent } from "react";
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

export const KeyEditor = () => {
  const { state, getKey, updateKey } = useStreamDeck();

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
    reader.onload = async (loadEvent) => {
      const imageData = loadEvent.target?.result;
      if (typeof imageData !== "string") {
        return;
      }

      updateKey(key.id, {
        image: imageData,
        label: file.name.replace(/\.[^.]+$/, ""),
      });

      if (state.isConnected && window.streamDockApi) {
        await window.streamDockApi.setKeyImage(key.id, imageData);
      }
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleClear = async () => {
    updateKey(key.id, { image: undefined, label: undefined });

    if (state.isConnected && window.streamDockApi) {
      await window.streamDockApi.clearKeyImage(key.id);
    }
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
          onClick={() => void handleClear()}
          disabled={!key.image}
        >
          Clear Key Image
        </Button>

        <Alert severity={state.isConnected ? "success" : "warning"}>
          {state.isConnected
            ? "Uploads are sent to the connected MiraBox immediately."
            : "You can prepare images while disconnected. They will upload on the next connection."}
        </Alert>
      </CardContent>
    </Card>
  );
};

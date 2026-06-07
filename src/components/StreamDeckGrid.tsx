import { useStreamDeck } from "../context/useStreamDeck";
import type { StreamDeckKey } from "../context/StreamDeckContext";
import { KeyLabelDisplay } from "./KeyLabelDisplay";
import { getSideDisplaySlots } from "../utils/sideDisplaySlots";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  DeleteOutlined as DeleteIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
} from "@mui/icons-material";
import { useRef, useState, type ChangeEvent, type MouseEvent } from "react";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const KEY_CELL_SIZE_PX = 100;
const KEY_GRID_GAP_PX = 10;
const KEY_ROW_COUNT = 3;
const KEY_COLUMN_COUNT = 5;
const SIDE_DISPLAY_CELL_SIZE_PX = 80;

const keyImageSx = {
  width: "100%",
  height: "100%",
  objectFit: "cover" as const,
  borderRadius: 1,
  display: "block",
};

export const StreamDeckGrid = () => {
  const {
    state,
    selectKey,
    addPage,
    deleteCurrentPage,
    setSideDisplayMode,
    updateSideDisplayImage,
    goToPreviousPage,
    goToNextPage,
  } = useStreamDeck();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sideDisplayImageSlotIdToDelete, setSideDisplayImageSlotIdToDelete] =
    useState<number | null>(null);
  const sideDisplayFileInputRef = useRef<HTMLInputElement>(null);
  const selectedSideDisplaySlotIdRef = useRef<number | null>(null);
  const hasMultiplePages = state.pages.length > 1;
  const activePage = state.pages[state.activePageIndex];
  const isCustomSideDisplay = activePage?.sideDisplay.mode === "custom-images";
  const sideDisplaySlots = activePage
    ? getSideDisplaySlots(
        activePage.sideDisplay,
        state.activePageIndex,
        state.pages.length,
      )
    : [];

  const handleConfirmDeletePage = () => {
    deleteCurrentPage();
    setIsDeleteDialogOpen(false);
  };

  const openSideDisplayUpload = (slotId: number) => {
    if (!isCustomSideDisplay) {
      return;
    }

    selectedSideDisplaySlotIdRef.current = slotId;
    sideDisplayFileInputRef.current?.click();
  };

  const handleSideDisplayImageUpload = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    const slotId = selectedSideDisplaySlotIdRef.current;
    event.target.value = "";

    if (!file || slotId === null || !ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const imageData = loadEvent.target?.result;
      if (typeof imageData !== "string") {
        return;
      }

      updateSideDisplayImage(slotId, imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSideDisplayImage = (
    event: MouseEvent<HTMLButtonElement>,
    slotId: number,
  ) => {
    event.stopPropagation();
    setSideDisplayImageSlotIdToDelete(slotId);
  };

  const closeSideDisplayDeleteDialog = () => {
    setSideDisplayImageSlotIdToDelete(null);
  };

  const handleConfirmDeleteSideDisplayImage = () => {
    if (sideDisplayImageSlotIdToDelete === null) {
      return;
    }

    updateSideDisplayImage(sideDisplayImageSlotIdToDelete, undefined);
    closeSideDisplayDeleteDialog();
  };

  const handleSideDisplayModeChange = (
    _event: MouseEvent<HTMLElement>,
    mode: "page-info" | "custom-images" | null,
  ) => {
    if (!mode) {
      return;
    }

    setSideDisplayMode(mode);
  };

  return (
    <>
      <input
        ref={sideDisplayFileInputRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        onChange={handleSideDisplayImageUpload}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            width: "658px",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              width: "100%",
              display: "flex",
              gap: 1,
              justifyContent: "left",
            }}
          >
            <Button
              variant="outlined"
              startIcon={<NavigateBeforeIcon />}
              onClick={goToPreviousPage}
              disabled={!hasMultiplePages}
              size="small"
            >
              Previous
            </Button>
            <Typography
              variant="subtitle1"
              sx={{ minWidth: 92, textAlign: "center" }}
            >
              Page {state.activePageIndex + 1} of {state.pages.length}
            </Typography>
            <Button
              variant="outlined"
              endIcon={<NavigateNextIcon />}
              onClick={goToNextPage}
              disabled={!hasMultiplePages}
              size="small"
            >
              Next
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addPage}
              size="small"
            >
              Add Page
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={!hasMultiplePages}
              size="small"
            >
              Delete Page
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${KEY_COLUMN_COUNT}, ${KEY_CELL_SIZE_PX}px)`,
              gridTemplateRows: `repeat(${KEY_ROW_COUNT}, ${KEY_CELL_SIZE_PX}px)`,
              gap: `${KEY_GRID_GAP_PX}px`,
              flexShrink: 0,
            }}
          >
            {state.keys.map((key: StreamDeckKey) => (
              <Paper
                key={key.id}
                onClick={() => selectKey(key.id)}
                onMouseEnter={() => setHoveredId(key.id)}
                onMouseLeave={() => setHoveredId(null)}
                sx={{
                  aspectRatio: "1",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 0.75,
                  position: "relative",
                  overflow: "hidden",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  border:
                    state.selectedKeyId === key.id ? "3px solid" : "2px solid",
                  borderColor:
                    state.selectedKeyId === key.id ? "#58a6ff" : "#404050",
                  background:
                    state.selectedKeyId === key.id
                      ? "linear-gradient(135deg, #404050 0%, #2d2d44 100%)"
                      : "linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)",
                  boxShadow:
                    state.selectedKeyId === key.id
                      ? "0 0 12px rgba(88, 166, 255, 0.5), inset 0 0 6px rgba(88, 166, 255, 0.1)"
                      : hoveredId === key.id
                        ? "0 0 8px rgba(88, 166, 255, 0.3)"
                        : "0 2px 4px rgba(0, 0, 0, 0.3)",
                  "&:hover": {
                    borderColor: "#5a5a6a",
                    boxShadow: "0 4px 14px rgba(88, 166, 255, 0.35)",
                  },
                }}
              >
                {key.image ? (
                  <Box
                    component="img"
                    src={key.image}
                    alt={key.label || `Key ${key.id + 1}`}
                    sx={keyImageSx}
                  />
                ) : key.label ? (
                  <KeyLabelDisplay label={key.label} variant="standalone" />
                ) : (
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: "bold",
                      color: "#808080",
                    }}
                  >
                    {key.id + 1}
                  </Typography>
                )}
                {key.label && key.image ? (
                  <KeyLabelDisplay
                    label={key.label}
                    variant="overlay"
                    fontSize="10px"
                  />
                ) : null}
              </Paper>
            ))}
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: "30px",
              flexShrink: 0,
              justifyContent: "center",
              p: "8px",
              borderRadius: 3,
              border: "2px solid #263241",
              background:
                "linear-gradient(180deg, #070a0f 0%, #111827 48%, #070a0f 100%)",
              boxShadow:
                "inset 0 0 14px rgba(88, 166, 255, 0.08), 0 8px 22px rgba(0, 0, 0, 0.35)",
            }}
          >
            {sideDisplaySlots.map((slot) => (
              <Paper
                key={slot.id}
                elevation={0}
                onClick={() => openSideDisplayUpload(slot.id)}
                sx={{
                  width: SIDE_DISPLAY_CELL_SIZE_PX,
                  height: SIDE_DISPLAY_CELL_SIZE_PX,
                  flexShrink: 0,
                  background: "#000000",
                  border: "1px solid rgba(88, 166, 255, 0.18)",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                  cursor: isCustomSideDisplay ? "pointer" : "default",
                  boxShadow:
                    "inset 0 0 10px rgba(0, 0, 0, 0.85), inset 0 0 2px rgba(255, 255, 255, 0.18)",
                  opacity: state.isConnected ? 1 : 0.86,
                  "&:hover": isCustomSideDisplay
                    ? {
                        borderColor: "#58a6ff",
                        boxShadow:
                          "inset 0 0 10px rgba(0, 0, 0, 0.85), 0 0 10px rgba(88, 166, 255, 0.35)",
                        "& .side-display-delete-button": {
                          opacity: 1,
                          pointerEvents: "auto",
                        },
                      }
                    : undefined,
                }}
              >
                {slot.image ? (
                  <>
                    <Box
                      component="img"
                      src={slot.image}
                      alt={`Side display ${slot.id - 14}`}
                      sx={keyImageSx}
                    />
                    {isCustomSideDisplay ? (
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Delete side display ${slot.id - 14} image`}
                        onClick={(event) =>
                          handleDeleteSideDisplayImage(event, slot.id)
                        }
                        sx={{
                          position: "absolute",
                          top: 3,
                          right: 3,
                          zIndex: 3,
                          width: 24,
                          height: 24,
                          opacity: 0,
                          pointerEvents: "none",
                          transition: "opacity 0.15s ease",
                          bgcolor: "rgba(0, 0, 0, 0.72)",
                          "&:hover": {
                            bgcolor: "rgba(218, 54, 51, 0.88)",
                            color: "#ffffff",
                          },
                        }}
                        className="side-display-delete-button"
                      >
                        <DeleteIcon color="action" fontSize="inherit" />
                      </IconButton>
                    ) : null}
                  </>
                ) : (
                  <KeyLabelDisplay
                    label={slot.label ?? "Upload"}
                    variant="standalone"
                  />
                )}
              </Paper>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            width: "658px",
            display: "flex",
            gap: 1,
            alignItems: "center",
          }}
        >
          <Typography>Side Display options:</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={activePage?.sideDisplay.mode ?? "page-info"}
            onChange={handleSideDisplayModeChange}
            aria-label="Side display mode"
            sx={{
              "& .Mui-selected": {
                cursor: "default",
                pointerEvents: "none",
              },
              "& .Mui-selected:hover": {
                backgroundColor: "primary.main",
              },
            }}
          >
            <ToggleButton value="page-info" aria-label="Show page information">
              Show Page Info
            </ToggleButton>
            <ToggleButton value="custom-images" aria-label="Show images">
              Show Images
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Page?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will delete page {state.activePageIndex + 1} and all of its key
            images, labels, and actions.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeletePage}
          >
            Delete Page
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={sideDisplayImageSlotIdToDelete !== null}
        onClose={closeSideDisplayDeleteDialog}
      >
        <DialogTitle>Delete Side Display Image?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will remove the uploaded image from this side display slot.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSideDisplayDeleteDialog}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeleteSideDisplayImage}
          >
            Delete Image
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

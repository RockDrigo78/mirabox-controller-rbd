import { Box, Typography } from "@mui/material";

type KeyLabelDisplayProps = {
  label: string;
  variant: "overlay" | "standalone";
  fontSize?: string;
};

export const KeyLabelDisplay = ({
  label,
  variant,
  fontSize = "11px",
}: KeyLabelDisplayProps) => {
  const typographySx = {
    fontWeight: 600,
    color: "#fff",
    textAlign: "center" as const,
    lineHeight: 1.2,
    fontSize: variant === "standalone" ? "0.8rem" : fontSize,
    textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)",
    wordBreak: "break-word" as const,
    maxWidth: "100%",
  };

  const bottomLabelBarSx = {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    px: 1,
    pb: 0.75,
    pt: 3,
    pointerEvents: "none" as const,
    background:
      variant === "overlay"
        ? "linear-gradient(to top, rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.28) 45%, transparent 100%)"
        : undefined,
  };

  if (variant === "overlay") {
    return (
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          ...bottomLabelBarSx,
        }}
      >
        <Typography
          component="span"
          sx={{
            ...typographySx,
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        ...bottomLabelBarSx,
      }}
    >
      <Typography
        component="span"
        sx={{
          ...typographySx,
          color: "#ddd",
          width: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

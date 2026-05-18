import { StreamDeckProvider } from "./context/StreamDeckContext";
import { StatusBar } from "./components/StatusBar";
import { StreamDeckGrid } from "./components/StreamDeckGrid";
import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#58a6ff",
    },
    secondary: {
      main: "#79c0ff",
    },
    background: {
      default: "#0d1117",
      paper: "#161b22",
    },
    success: {
      main: "#3fb950",
    },
    error: {
      main: "#da3633",
    },
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StreamDeckProvider>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            bgcolor: "#0d1117",
          }}
        >
          <StatusBar />
          <Box
            component="main"
            sx={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              p: 2,
              gap: 2,
            }}
          >
            <StreamDeckGrid />
          </Box>
        </Box>
      </StreamDeckProvider>
    </ThemeProvider>
  );
}

export default App;

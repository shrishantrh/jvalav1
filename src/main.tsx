import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeThemeColor } from "./hooks/useThemeColor";
import { initializeCapacitor } from "./lib/capacitor";

// Initialize theme color before render
initializeThemeColor();

// Initialize Capacitor for native mobile
initializeCapacitor();

createRoot(document.getElementById("root")!).render(<App />);

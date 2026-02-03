import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeThemeColor } from "./hooks/useThemeColor";

// Initialize theme color before render
initializeThemeColor();

createRoot(document.getElementById("root")!).render(<App />);

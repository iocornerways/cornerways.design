import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css";
import "./preview.css";
import "../src/install/install.css";
import { initInstallPrompt } from "../src/install/install.js";
import { Preview } from "./Preview.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);

// The install card: shows on an iPhone/iPad (or DevTools device emulation) and
// wherever the browser fires beforeinstallprompt.
initInstallPrompt({ appName: "Preview" });

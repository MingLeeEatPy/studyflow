import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { registerPwa } from "./pwa";

const root = createRoot(document.getElementById("root")!);
const isDesignPreview = new URLSearchParams(window.location.search).get("design-preview") === "1";

if (isDesignPreview) {
  void import("./design-preview/DesignPreviewApp").then(({ DesignPreviewApp }) => {
    root.render(<StrictMode><DesignPreviewApp /></StrictMode>);
  });
} else {
  void Promise.all([import("./app/App"), import("./styles/global.css"), import("./styles/nature.css")]).then(([{ default: App }]) => {
    root.render(<StrictMode><App /><PwaUpdatePrompt /></StrictMode>);
    registerPwa((update) => window.dispatchEvent(new CustomEvent('studyflow:pwa-update', { detail: update })));
  });
}

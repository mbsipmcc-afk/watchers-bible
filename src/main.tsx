import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// Chromium only grants persistent storage with user activation; the starter
// pack's async chain loses the gesture, so re-ask on the first interaction.
(function armPersist() {
  const ask = () => {
    try {
      void navigator.storage?.persist?.();
    } catch {
      /* unsupported */
    }
    window.removeEventListener("pointerdown", ask);
  };
  window.addEventListener("pointerdown", ask, { once: true });
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

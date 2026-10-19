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

// PWA app-shortcut landing: /?go=read | /?go=search → route + clean URL.
(function handleShortcut() {
  try {
    const go = new URLSearchParams(location.search).get("go");
    if (!go) return;
    history.replaceState(null, "", location.pathname);
    if (go === "read") {
      const stored = localStorage.getItem("wb-lastread");
      let path = "#/read/kjv/1/1";
      try {
        const lr = stored ? JSON.parse(stored) : null;
        if (lr?.translation && lr?.book && lr?.chapter) {
          path = `#/read/${lr.translation}/${lr.book}/${lr.chapter}`;
        }
      } catch {
        /* fallback path */
      }
      location.hash = path;
    } else if (go === "search") {
      location.hash = "#/search";
    }
  } catch {
    /* malformed query: ignore */
  }
})();

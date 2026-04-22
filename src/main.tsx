import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA service worker registration with iframe / preview guard.
// In Lovable's preview iframe, service workers cause stale content issues,
// so we unregister any existing SWs there. In production they activate normally.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

if (isPreviewHost || isInIframe) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Dynamic import so vite-plugin-pwa virtual module never loads in preview
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      /* noop */
    });
}

createRoot(document.getElementById("root")!).render(<App />);

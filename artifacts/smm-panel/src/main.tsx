import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Catch all unhandled promise rejections and log the real message
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    console.error("[UnhandledRejection]", reason.message, reason);
  } else {
    console.error("[UnhandledRejection]", reason);
  }
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);

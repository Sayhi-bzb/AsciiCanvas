import React from "react";
import ReactDOM from "react-dom/client";
import "@ascii-canvas/fonts/fonts.css";
import "./index.css";
import { captureOnboardingEntryState } from "@/widgets/onboarding/onboarding-model";

captureOnboardingEntryState();

void import("./App").then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

import React from "react";
import ReactDOM from "react-dom/client";
import "@chardesk/fonts/fonts.css";
import "./index.css";
import { captureOnboardingEntryState } from "@/widgets/onboarding/onboarding-model";
import { initializeApplication } from "./compositionRoot";
import { EditorProvider } from "@/domains/editor/public";

initializeApplication();
captureOnboardingEntryState();

void import("./App").then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <EditorProvider>
        <App />
      </EditorProvider>
    </React.StrictMode>
  );
});

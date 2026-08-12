import React from "react";
import ReactDOM from "react-dom/client";
import "@chardesk/fonts/fonts.css";
import "./index.css";
import { captureOnboardingEntryState } from "@/widgets/onboarding/onboarding-model";
import { getApplicationEditorHost } from "./compositionRoot";
import { EditorProvider } from "@/domains/editor/public";
import { CanvasRuntimeProvider } from "@/domains/canvas/public";
import { CollaborationRuntimeProvider } from "@/domains/collaboration/public";

const host = getApplicationEditorHost();
captureOnboardingEntryState();

void import("./App").then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <CanvasRuntimeProvider runtime={host.canvas}>
        <CollaborationRuntimeProvider runtime={host.collaboration}>
          <EditorProvider editor={host.editor}>
            <App />
          </EditorProvider>
        </CollaborationRuntimeProvider>
      </CanvasRuntimeProvider>
    </React.StrictMode>
  );
});

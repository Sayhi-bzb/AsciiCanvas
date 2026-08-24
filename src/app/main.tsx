import React from "react";
import ReactDOM from "react-dom/client";
import "@chardesk/fonts/fonts.css";
import "./index.css";
import { captureOnboardingEntryState } from "@/widgets/onboarding/onboarding-model";
import { getApplicationEditorHost } from "./compositionRoot";
import { EditorProvider } from "@/domains/editor/public";
import { CanvasRuntimeProvider } from "@/domains/canvas/public";
import { CollaborationRuntimeProvider } from "@/domains/collaboration/public";
import { TextRenderingProvider } from "@/domains/document/public";
import {
  BLACKBOARD_HOST_PROFILE,
  EDITOR_HOST_PROFILE,
} from "./editorHostProfile";
import { EditorHostProfileProvider } from "./editorHostProfileContext";
import {
  installModuleLoadRecovery,
  isModuleReloadPending,
  requireLoadedModule,
} from "./moduleLoadRecovery";

const profile = window.location.pathname === "/blackboard"
  ? BLACKBOARD_HOST_PROFILE
  : EDITOR_HOST_PROFILE;
const host = getApplicationEditorHost(profile);
if (new URLSearchParams(window.location.search).has("canvas-stress")) {
  Object.defineProperty(window, "__chardeskCanvasStress", {
    configurable: true,
    value: {
      ready: () => host.canvas.ready,
      flush: () => host.canvas.retryPersistence(),
      cellCount: () => host.canvas.getState().grid.size,
      persistence: () => host.canvas.getPersistenceSnapshot(),
    },
  });
}
if (profile.id === "editor") captureOnboardingEntryState();
installModuleLoadRecovery();

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <main className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
    Restoring canvas…
  </main>
);

const renderLoadFailure = () => {
  root.render(
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
      <div role="alert" className="flex max-w-sm flex-col items-start gap-3">
        <h1 className="text-base font-medium">Unable to load CharDesk</h1>
        <p className="text-sm text-muted-foreground">
          The interface changed or its cache expired. Reload to try again.
        </p>
        <button
          type="button"
          className="rounded-control bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </main>
  );
};

void Promise.all([host.canvas.ready, import("./App")]).then(([, module]) => {
  const { default: App } = requireLoadedModule(module);
  root.render(
    <React.StrictMode>
      <EditorHostProfileProvider profile={host.profile}>
        <TextRenderingProvider runtime={host.textRendering}>
          <CanvasRuntimeProvider runtime={host.canvas}>
            <CollaborationRuntimeProvider runtime={host.collaboration}>
              <EditorProvider editor={host.editor}>
                <App />
              </EditorProvider>
            </CollaborationRuntimeProvider>
          </CanvasRuntimeProvider>
        </TextRenderingProvider>
      </EditorHostProfileProvider>
    </React.StrictMode>
  );
}).catch((error: unknown) => {
  if (isModuleReloadPending()) return;
  console.error(error);
  renderLoadFailure();
});

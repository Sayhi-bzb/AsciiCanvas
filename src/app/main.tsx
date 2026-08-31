import React from "react";
import ReactDOM from "react-dom/client";
import "@chardesk/fonts/fonts.css";
import "./index.css";
import { captureOnboardingEntryState } from "@/widgets/onboarding/onboarding-model";
import { ModuleLoadFailure, ModuleLoadingScreen } from "./StartupScreens";
import { getApplicationEditorHost } from "./compositionRoot";
import { EditorProvider } from "@/domains/editor/public";
import {
  CanvasRuntimeProvider,
  getSurfaceGridReader,
} from "@/domains/canvas/public";
import { CollaborationRuntimeProvider } from "@/domains/collaboration/public";
import { TextRenderingProvider } from "@/domains/document/public";
import { BlackboardRuntimeProvider } from "@/domains/blackboard/public";
import { EDITOR_HOST_PROFILE } from "./editorHostProfile";
import { EditorHostProfileProvider } from "./editorHostProfileContext";
import {
  installModuleLoadRecovery,
  isModuleReloadPending,
  requireLoadedModule,
} from "@/shared/lib/moduleLoadRecovery";
import { createBlackboardAgentTools } from "./site-tools/blackboardTools";
import { startOriginSiteToolGateway } from "./site-tools/originGateway";
import {
  prepareDocumentWebMcp,
  updateWebMcpDiagnostics,
  type WebMcpProvider,
} from "./site-tools/environment";

const profile = EDITOR_HOST_PROFILE;
const host = getApplicationEditorHost(profile);
const blackboardAgentTools = createBlackboardAgentTools({
  blackboard: host.blackboard,
});

const startBlackboardSiteTools = async () => {
  let provider: WebMcpProvider = "unavailable";
  updateWebMcpDiagnostics(document, provider, {
    role: navigator.locks ? "standby" : "unsupported",
    status: navigator.locks ? "waiting" : "failed",
    adapterId: null,
  });
  try {
    provider = await prepareDocumentWebMcp({
      target: document,
      url: new URL(window.location.href),
      dev: import.meta.env.DEV,
      envPolyfill: import.meta.env.VITE_WEBMCP_DEV_POLYFILL === "1",
    });
  } catch (error) {
    console.warn("Unable to initialize the WebMCP development polyfill.", error);
  }

  startOriginSiteToolGateway({
    target: document,
    tools: blackboardAgentTools,
    onStatusChange: (snapshot) => {
      if (snapshot.adapterId !== null && provider !== "polyfill") {
        provider = "native";
      }
      updateWebMcpDiagnostics(document, provider, snapshot);
    },
  });

  if (import.meta.env.DEV && provider === "unavailable") {
    console.info(
      "WebMCP is unavailable. Enable chrome://flags/#enable-webmcp-testing or add ?webmcp=polyfill for local protocol testing.",
    );
  }
};

void startBlackboardSiteTools();
if (new URLSearchParams(window.location.search).has("canvas-stress")) {
  Object.defineProperty(window, "__chardeskCanvasStress", {
    configurable: true,
    value: {
      ready: () => host.canvas.ready,
      flush: () => host.canvas.retryPersistence(),
      switchSession: (id: string) => host.canvas.commands.sessions.switch(id),
      cellCount: () => host.canvas.queries.getActiveCellCount(),
      surfaceStats: () => {
        const reader = getSurfaceGridReader(host.canvas.getState().grid);
        return reader && "getStats" in reader && typeof reader.getStats === "function"
          ? reader.getStats()
          : null;
      },
      memoryStats: () => host.canvas.queries.getMemoryStats(),
      resourceStats: () => {
        const memory = host.canvas.queries.getMemoryStats();
        const experience = (window as Window & {
          __chardeskCanvasExperienceStats?: () => {
            viewportActivities: number;
            directFrames: number;
            directGlyphs: number;
            totalDirectGlyphs: number;
            lastFrameDurationMs: number | null;
            maxFrameDurationMs: number;
            longFrames: number;
            lastInputPaintMs: number | null;
            lastSettleLatencyMs: number | null;
          };
        }).__chardeskCanvasExperienceStats?.();
        return {
          pressure: "normal",
          hidden: document.hidden,
          accountedBytes: memory.projectionCacheBudgetBytes,
          nominalBudgetBytes: memory.projectionCacheBudgetLimit,
          cellPlaneBytes: memory.projectionCacheBudgetBytes,
          viewportActivities: experience?.viewportActivities ?? 0,
          directFrames: experience?.directFrames ?? 0,
          directGlyphs: experience?.directGlyphs ?? 0,
          totalDirectGlyphs: experience?.totalDirectGlyphs ?? 0,
          lastFrameDurationMs: experience?.lastFrameDurationMs ?? 0,
          maxFrameDurationMs: experience?.maxFrameDurationMs ?? 0,
          longFrames: experience?.longFrames ?? 0,
          inputPaintMs: experience?.lastInputPaintMs ?? 0,
          settleLatencyMs: experience?.lastSettleLatencyMs ?? 0,
        };
      },
      persistence: () => host.canvas.getPersistenceSnapshot(),
    },
  });
}
if (window.location.pathname !== "/blackboard") {
  captureOnboardingEntryState();
}
installModuleLoadRecovery();

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(<ModuleLoadingScreen />);

const renderLoadFailure = () => {
  root.render(<ModuleLoadFailure onReload={() => window.location.reload()} />);
};

void import("./App").then((module) => {
  const { default: App } = requireLoadedModule(module);
  root.render(
    <React.StrictMode>
      <EditorHostProfileProvider profile={host.profile}>
        <BlackboardRuntimeProvider runtime={host.blackboard}>
          <TextRenderingProvider runtime={host.textRendering}>
            <CanvasRuntimeProvider runtime={host.canvas}>
              <CollaborationRuntimeProvider runtime={host.collaboration}>
                <EditorProvider editor={host.editor}>
                  <App />
                </EditorProvider>
              </CollaborationRuntimeProvider>
            </CanvasRuntimeProvider>
          </TextRenderingProvider>
        </BlackboardRuntimeProvider>
      </EditorHostProfileProvider>
    </React.StrictMode>
  );
}).catch((error: unknown) => {
  if (isModuleReloadPending()) return;
  console.error(error);
  renderLoadFailure();
});

import React from "react";
import ReactDOM from "react-dom/client";
import "@chardesk/fonts/fonts.css";
import "./index.css";
import { captureOnboardingEntryState } from "@/widgets/onboarding/onboarding-model";
import { getApplicationEditorHost } from "./compositionRoot";
import { EditorProvider } from "@/domains/editor/public";
import {
  CanvasRuntimeProvider,
  getSurfaceGridReader,
} from "@/domains/canvas/public";
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
} from "@/shared/lib/moduleLoadRecovery";

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
      switchSession: (id: string) => host.canvas.commands.sessions.switch(id),
      cellCount: () => host.canvas.queries.getActiveCellCount(),
      surfaceStats: () => {
        const reader = getSurfaceGridReader(host.canvas.getState().grid);
        return reader && "getStats" in reader && typeof reader.getStats === "function"
          ? reader.getStats()
          : null;
      },
      memoryStats: () => host.canvas.queries.getMemoryStats(),
      rasterStats: () => (window as Window & {
        __chardeskCanvasRasterStats?: () => Record<string, number>;
      }).__chardeskCanvasRasterStats?.() ?? null,
      renderWorkerStats: () => (window as Window & {
        __chardeskCanvasRenderWorkerStats?: () => Record<
          string,
          number | boolean | string | null
        >;
      }).__chardeskCanvasRenderWorkerStats?.() ?? null,
      resourceStats: () => {
        const snapshot = (window as Window & {
          __chardeskCanvasResourceStats?: () => {
            memory: {
              pressure: string;
              hidden: boolean;
              totalBytes: number;
              nominalBudget: number;
              usage: Record<string, number>;
            };
            worker: { loadedFontFaces: number };
            raster: {
              qualityByPane: Record<string, {
                scaleError: number;
                sharpCoverage: number;
                transientBytes: number;
              }>;
            };
          };
        }).__chardeskCanvasResourceStats?.();
        if (!snapshot) return null;
        const experience = (window as Window & {
          __chardeskCanvasExperienceStats?: () => {
            presentationFrames: number;
            panRebases: number;
            deferredPanRenders: number;
            panSceneInvalidations: number;
            panMissingBaselines: number;
            viewportActivities: number;
            directGlyphs: number;
            lastSettleLatencyMs: number | null;
          };
        }).__chardeskCanvasExperienceStats?.();
        const paneQuality = Object.values(snapshot.raster.qualityByPane);
        return {
          pressure: snapshot.memory.pressure,
          hidden: snapshot.memory.hidden,
          accountedBytes: snapshot.memory.totalBytes,
          nominalBudgetBytes: snapshot.memory.nominalBudget,
          cellPlaneBytes: snapshot.memory.usage["cell-plane"] ?? 0,
          workerSourceBytes: snapshot.memory.usage["worker-source"] ?? 0,
          loadedFontFaces: snapshot.worker.loadedFontFaces,
          minimumSharpCoverage: paneQuality.length > 0
            ? Math.min(...paneQuality.map(({ sharpCoverage }) => sharpCoverage))
            : 1,
          maximumScaleError: paneQuality.length > 0
            ? Math.max(...paneQuality.map(({ scaleError }) => scaleError))
            : 0,
          transientRasterBytes: paneQuality.reduce(
            (bytes, quality) => bytes + quality.transientBytes,
            0
          ),
          presentationFrames: experience?.presentationFrames ?? 0,
          panRebases: experience?.panRebases ?? 0,
          deferredPanRenders: experience?.deferredPanRenders ?? 0,
          panSceneInvalidations: experience?.panSceneInvalidations ?? 0,
          panMissingBaselines: experience?.panMissingBaselines ?? 0,
          viewportActivities: experience?.viewportActivities ?? 0,
          directGlyphs: experience?.directGlyphs ?? 0,
          settleLatencyMs: experience?.lastSettleLatencyMs ?? 0,
        };
      },
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

import { acquireOriginExclusiveLease } from "@/shared/services/originExclusiveLease";
import {
  hasDocumentSiteToolHost,
  startDocumentSiteTools,
  type SiteToolConnectorSnapshot,
  type SiteToolConnectorStatus,
} from "./connector";
import type {
  AgentToolDefinition,
  SiteToolHostAdapterId,
} from "./contracts";

const GATEWAY_LOCK_NAME = "chardesk-webmcp-agent-gateway-v1";
const DEFAULT_RETRY_DELAYS = [50, 100, 250, 500, 1_000, 2_000] as const;

type OriginSiteToolRole = "leader" | "standby" | "unsupported";

export type OriginSiteToolGatewaySnapshot = Readonly<{
  role: OriginSiteToolRole;
  status: SiteToolConnectorStatus;
  adapterId: SiteToolHostAdapterId | null;
}>;

type OriginSiteToolGatewayOptions = Readonly<{
  target: Document;
  tools: readonly AgentToolDefinition[];
  retryDelays?: readonly number[];
  lockManager?: LockManager | null;
  onStatusChange?: (snapshot: OriginSiteToolGatewaySnapshot) => void;
}>;

type OriginSiteToolGateway = Readonly<{
  getSnapshot: () => OriginSiteToolGatewaySnapshot;
  dispose: () => void;
}>;

export const startOriginSiteToolGateway = ({
  target,
  tools,
  retryDelays = DEFAULT_RETRY_DELAYS,
  lockManager = target.defaultView?.navigator.locks ?? null,
  onStatusChange,
}: OriginSiteToolGatewayOptions): OriginSiteToolGateway => {
  const lifecycle = target.defaultView;
  const delays = retryDelays.length > 0 ? retryDelays : DEFAULT_RETRY_DELAYS;
  let snapshot: OriginSiteToolGatewaySnapshot = {
    role: lockManager ? "standby" : "unsupported",
    status: lockManager ? "waiting" : "failed",
    adapterId: null,
  };
  let disposed = false;
  let retryIndex = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let pendingController: AbortController | null = null;
  let releaseLease: (() => void) | null = null;
  let disposeConnector: (() => void) | null = null;

  const publish = (next: OriginSiteToolGatewaySnapshot) => {
    snapshot = next;
    onStatusChange?.(snapshot);
  };

  const clearRetry = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const scheduleRetry = () => {
    if (disposed || pending || timer !== null || !lockManager) return;
    const delay = delays[Math.min(retryIndex, delays.length - 1)]!;
    retryIndex += 1;
    timer = setTimeout(() => {
      timer = null;
      probe();
    }, delay);
  };

  const becomeLeader = (leaseRelease: () => void) => {
    if (disposed) {
      leaseRelease();
      return;
    }
    releaseLease = leaseRelease;
    publish({ role: "leader", status: "registering", adapterId: null });
    const connector = startDocumentSiteTools({
      target,
      tools,
      retryDelays,
      onStatusChange: (connectorSnapshot: SiteToolConnectorSnapshot) => {
        publish({ role: "leader", ...connectorSnapshot });
      },
    });
    disposeConnector = connector.dispose;
  };

  const queueForLeadership = () => {
    if (disposed || pending || !lockManager) return;
    pending = true;
    pendingController = new AbortController();
    publish({ role: "standby", status: "waiting", adapterId: null });
    void acquireOriginExclusiveLease({
      manager: lockManager,
      name: GATEWAY_LOCK_NAME,
      wait: true,
      signal: pendingController.signal,
    }).then((lease) => {
      pending = false;
      pendingController = null;
      if (lease) becomeLeader(lease.release);
    }).catch((error: unknown) => {
      pending = false;
      pendingController = null;
      if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
      publish({ role: "standby", status: "failed", adapterId: null });
    });
  };

  const probe = () => {
    if (disposed || pending || !lockManager) return;
    if (!hasDocumentSiteToolHost(target)) {
      scheduleRetry();
      return;
    }
    clearRetry();
    queueForLeadership();
  };

  const probeNow = () => {
    if (disposed || pending || snapshot.role === "leader") return;
    clearRetry();
    probe();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearRetry();
    pendingController?.abort();
    pendingController = null;
    disposeConnector?.();
    disposeConnector = null;
    releaseLease?.();
    releaseLease = null;
    lifecycle?.removeEventListener("focus", probeNow);
    lifecycle?.removeEventListener("pageshow", probeNow);
    lifecycle?.removeEventListener("pagehide", dispose);
    target.removeEventListener("visibilitychange", probeNow);
    publish({ ...snapshot, status: "disposed" });
  };

  lifecycle?.addEventListener("focus", probeNow);
  lifecycle?.addEventListener("pageshow", probeNow);
  lifecycle?.addEventListener("pagehide", dispose);
  target.addEventListener("visibilitychange", probeNow);
  publish(snapshot);
  probe();

  return { getSnapshot: () => snapshot, dispose };
};

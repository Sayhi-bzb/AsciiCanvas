import {
  getDocumentModelContext,
  hasRegisterTool,
  isStandardWebMcpContext,
} from "./modelContext";
import type { OriginSiteToolGatewaySnapshot } from "./originGateway";

export type WebMcpProvider = "native" | "openai" | "polyfill" | "unavailable";

type WebMcpPolyfillLoader = () => Promise<void>;

type PrepareDocumentWebMcpOptions = Readonly<{
  target: Document;
  url: URL;
  dev: boolean;
  envPolyfill?: boolean;
  loadPolyfill?: WebMcpPolyfillLoader;
}>;

const loadDefaultPolyfill: WebMcpPolyfillLoader = async () => {
  const { initializeWebMCPPolyfill } = await import("@mcp-b/webmcp-polyfill");
  initializeWebMCPPolyfill();
};

export const detectDocumentWebMcpProvider = (
  target: Document,
): Exclude<WebMcpProvider, "polyfill"> => {
  const context = getDocumentModelContext(target);
  if (isStandardWebMcpContext(context)) return "native";
  return hasRegisterTool(context) ? "openai" : "unavailable";
};

export const prepareDocumentWebMcp = async ({
  target,
  url,
  dev,
  envPolyfill = false,
  loadPolyfill = loadDefaultPolyfill,
}: PrepareDocumentWebMcpOptions): Promise<WebMcpProvider> => {
  const existing = detectDocumentWebMcpProvider(target);
  if (existing !== "unavailable") return existing;

  const queryPolyfill = url.searchParams.get("webmcp") === "polyfill";
  if (!dev || (!envPolyfill && !queryPolyfill)) return "unavailable";

  await loadPolyfill();
  return detectDocumentWebMcpProvider(target) === "native"
    ? "polyfill"
    : "unavailable";
};

export const updateWebMcpDiagnostics = (
  target: Document,
  provider: WebMcpProvider,
  snapshot: OriginSiteToolGatewaySnapshot,
) => {
  target.documentElement.dataset.webmcpProvider = provider;
  target.documentElement.dataset.webmcpStatus = snapshot.status;
  target.documentElement.dataset.webmcpRole = snapshot.role;
};

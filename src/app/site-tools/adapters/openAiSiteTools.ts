import type { SiteToolHostAdapter } from "../contracts";
import {
  hasRegisterTool,
  toWebMcpTool,
  type OpenAiModelContext,
} from "../modelContext";

export const openAiSiteToolsAdapter: SiteToolHostAdapter<OpenAiModelContext> = {
  id: "openai-site-tools",
  supports: hasRegisterTool,
  async install(context, tools) {
    for (const tool of tools) {
      await context.registerTool(toWebMcpTool(tool, (input) => tool.execute(input)));
    }
    return { dispose: () => undefined };
  },
};

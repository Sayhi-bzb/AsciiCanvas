import { registerSelectionCommands } from "@/domains/actions/public";
import { registerDocumentSessionSource } from "@/domains/document/public";

let initialized = false;

export const initializeApplication = () => {
  if (initialized) return;
  initialized = true;
  registerSelectionCommands();
  registerDocumentSessionSource();
};

import type { StateCreator } from "zustand";
import type { CanvasState, SelectionSlice } from "./interfaces";

type SelectionCommands = Pick<
  SelectionSlice,
  | "canCopyOrCut"
  | "copySelection"
  | "cutSelection"
  | "pasteFromClipboard"
  | "copySelectionAsPng"
>;

export type SelectionCommandFactory = (
  set: Parameters<StateCreator<CanvasState, [], [], SelectionSlice>>[0],
  get: Parameters<StateCreator<CanvasState, [], [], SelectionSlice>>[1]
) => SelectionCommands;

const unavailable = async () => {
  throw new Error("Selection command handlers are not registered");
};

let commandFactory: SelectionCommandFactory = () => ({
  canCopyOrCut: () => false,
  copySelection: unavailable,
  cutSelection: unavailable,
  pasteFromClipboard: unavailable,
  copySelectionAsPng: unavailable,
});

export const registerSelectionCommandFactory = (
  factory: SelectionCommandFactory
) => {
  commandFactory = factory;
};

export const resolveSelectionCommands: SelectionCommandFactory = (set, get) =>
  commandFactory(set, get);

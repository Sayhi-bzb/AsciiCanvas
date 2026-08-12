import type { StateCreator } from "zustand";
import type { EditorState, SelectionSlice } from "./interfaces";

type SelectionCommands = Pick<
  SelectionSlice,
  | "canCopyOrCut"
  | "copySelection"
  | "cutSelection"
  | "pasteFromClipboard"
  | "copySelectionAsPng"
>;

export type SelectionCommandFactory = (
  set: Parameters<StateCreator<EditorState, [], [], SelectionSlice>>[0],
  get: Parameters<StateCreator<EditorState, [], [], SelectionSlice>>[1]
) => SelectionCommands;

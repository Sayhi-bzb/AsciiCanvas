import { useEffect, useRef } from "react";
import { createSequenceMatcher, type Hotkey } from "@tanstack/hotkeys";
import { useEditor } from "./react";
import { shortcutFromKeyboardEvent, type ShortcutSequence } from "./core/shortcut";
import type { EditorRuntime, EditorShortcutContext } from "./core/runtime";
import type { RegisteredKeymapEntry } from "./core/keymap";
import type { CanvasState } from "@/domains/canvas/public";
import type { ShortcutTargetKind } from "@/shared/utils/dom-focus";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";

const createEditorShortcutContext = (
  editor: EditorRuntime<CanvasState>,
  targetKind: ShortcutTargetKind,
  phase: "keydown" | "keyup" = "keydown"
): EditorShortcutContext<CanvasState> => {
  const state = editor.getState();
  return {
    state,
    targetKind,
    phase,
    target: { kind: targetKind },
    canvas: {
      mode: state.canvasMode,
      readOnly: false,
      hasTextCursor: state.textCursor !== null,
    },
    grid: {
      editMode: state.staticGridEditMode,
      hasRange: state.staticGridSelection.mode === "range",
    },
    structured: { hasSelection: state.selectedStructuredNodeIds.length > 0 },
    presentation: { active: false },
    tool: { id: state.tool },
  };
};

export const resolveEditorKeymapEvent = (
  editor: EditorRuntime<CanvasState>,
  event: KeyboardEvent,
  targetKind: ShortcutTargetKind,
  phase: "keydown" | "keyup" = "keydown"
) => {
  if (!shortcutFromKeyboardEvent(event)) return { type: "none" as const };
  const entry = editor.keymap.resolveEvent(
    event,
    createEditorShortcutContext(editor, targetKind, phase)
  )[0];
  return entry ? { type: "match" as const, entry } : { type: "none" as const };
};

const executeEntry = (
  editor: EditorRuntime<CanvasState>,
  entry: RegisteredKeymapEntry<EditorShortcutContext<CanvasState>>
) => {
  if (entry.target.type === "tool") {
    return editor.setCurrentTool(entry.target.id)
      ? { type: "executed" as const }
      : { type: "none" as const };
  }
  const result = editor.commands.execute(entry.target.id, undefined, "keyboard");
  return result.status === "succeeded" || result.status === "pending"
    ? { type: "executed" as const, result }
    : { type: "none" as const };
};

export const executeEditorKeymapEvent = (
  editor: EditorRuntime<CanvasState>,
  event: KeyboardEvent,
  targetKind: ShortcutTargetKind
) => {
  const resolution = resolveEditorKeymapEvent(editor, event, targetKind);
  if (resolution.type !== "match") return resolution;
  if (event.repeat && (resolution.entry.repeat ?? "ignore") === "ignore") {
    return { type: "none" as const };
  }
  return executeEntry(editor, resolution.entry);
};

export class EditorShortcutEngine {
  readonly #editor: EditorRuntime<CanvasState>;
  readonly #timeoutMs: number;
  #pending: Array<{
    sequence: ShortcutSequence;
    matcher: ReturnType<typeof createSequenceMatcher>;
  }> | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(editor: EditorRuntime<CanvasState>, timeoutMs = 1_500) {
    this.#editor = editor;
    this.#timeoutMs = timeoutMs;
  }

  cancelChord = () => {
    this.#pending = null;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  };

  dispose = () => this.cancelChord();

  #context(targetKind: ShortcutTargetKind): EditorShortcutContext<CanvasState> {
    return createEditorShortcutContext(this.#editor, targetKind);
  }

  #beginChord(starts: readonly { sequence: ShortcutSequence }[], event: KeyboardEvent) {
    this.cancelChord();
    this.#pending = starts.map(({ sequence }) => {
      const matcher = createSequenceMatcher([...sequence] as Hotkey[], { timeout: this.#timeoutMs });
      matcher.match(event);
      return { sequence, matcher };
    });
    this.#timer = setTimeout(this.cancelChord, this.#timeoutMs);
    return { type: "pending" as const };
  }

  handleKeyDown(event: KeyboardEvent, targetKind: ShortcutTargetKind) {
    if (event.key === "Escape" && this.#pending) {
      this.cancelChord();
      return { type: "cancelled" as const };
    }
    if (!shortcutFromKeyboardEvent(event)) return { type: "none" as const };
    const context = this.#context(targetKind);

    if (this.#pending) {
      const sequences = this.#pending
        .filter(({ matcher }) => matcher.match(event))
        .map(({ sequence }) => sequence);
      this.cancelChord();
      const entry = this.#editor.keymap.resolveCandidates(sequences, context)[0];
      if (entry && (!event.repeat || (entry.repeat ?? "ignore") === "allow")) {
        return executeEntry(this.#editor, entry);
      }
      // A mismatched second stroke starts a fresh root resolution.
    }

    const starts = this.#editor.keymap.getSequenceStarts(event, context);
    if (starts.length > 0) {
      return this.#beginChord(starts, event);
    }
    const entry = this.#editor.keymap.resolveEvent(event, context)[0];
    if (!entry || (event.repeat && (entry.repeat ?? "ignore") === "ignore")) {
      return { type: "none" as const };
    }
    return executeEntry(this.#editor, entry);
  }
}

export const useEditorShortcutLayer = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const editor = useEditor();
  const engineRef = useRef<EditorShortcutEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new EditorShortcutEngine(editor);
  }
  useEffect(() => {
    const engine = engineRef.current;
    const cancel = () => engine?.cancelChord();
    window.addEventListener("blur", cancel);
    window.addEventListener("compositionstart", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("compositionstart", cancel);
      engine?.dispose();
    };
  }, []);
  useShortcutLayer({
    id: "editor-keymap",
    priority: SHORTCUT_PRIORITY.globalAction,
    enabled,
    onKeyDown: (event, context) => {
      const result = engineRef.current!.handleKeyDown(event, context.targetKind);
      return result.type === "executed" || result.type === "pending" || result.type === "cancelled"
        ? { claimed: true, preventDefault: true }
        : undefined;
    },
  });
};

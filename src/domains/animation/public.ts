export * from "./model/animation";
export type {
  AnimationGeneratorConfig,
  AnimationGeneratorKind,
  GeneratedAnimationApplyMode,
} from "./generators/types";
export { generateAnimationFrames } from "./generators/generate";

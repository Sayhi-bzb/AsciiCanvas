"use client";

import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import {
  getAnimationFrameDelayMs
} from "@/domains/animation/public";
import { cn } from "@/shared/lib/utils";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { uiClass } from "@/shared/styles/components";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

const PreviousFrameIcon = HOST_ICONOLOGY.animationAction.previous;
const NextFrameIcon = HOST_ICONOLOGY.animationAction.next;
const PlayIcon = HOST_ICONOLOGY.animationAction.play;
const PauseIcon = HOST_ICONOLOGY.animationAction.pause;
const LoopIcon = HOST_ICONOLOGY.animationAction.loop;

const DEFAULT_GHOST_SETTINGS = {
  backwardLayers: 2,
  forwardLayers: 2,
  opacityFalloff: [0.5, 0.3],
} as const;

export function AnimationTimeline() {
  const {
    canvasMode,
    animationTimeline,
    animationIsPlaying,
    animationPlaybackFrameId,
    setAnimationFps,
    toggleAnimationLoop,
    setOnionSkinSettings,
    playAnimation,
    pauseAnimation,
    stepAnimationFrame,
    tickAnimationPlayback,
  } = useEditorStore(
    useShallow((state) => ({
      canvasMode: state.canvasMode,
      animationTimeline: state.animationTimeline,
      animationIsPlaying: state.animationIsPlaying,
      animationPlaybackFrameId: state.animationPlaybackFrameId,
      setAnimationFps: state.setAnimationFps,
      toggleAnimationLoop: state.toggleAnimationLoop,
      setOnionSkinSettings: state.setOnionSkinSettings,
      playAnimation: state.playAnimation,
      pauseAnimation: state.pauseAnimation,
      stepAnimationFrame: state.stepAnimationFrame,
      tickAnimationPlayback: state.tickAnimationPlayback,
    }))
  );
  const playbackFps = animationTimeline?.fps;

  useEffect(() => {
    if (
      canvasMode !== "animation" ||
      !playbackFps ||
      !animationIsPlaying
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      tickAnimationPlayback();
    }, getAnimationFrameDelayMs(playbackFps));

    return () => window.clearInterval(intervalId);
  }, [
    canvasMode,
    playbackFps,
    animationIsPlaying,
    tickAnimationPlayback,
  ]);

  const activeFrameIndex = useMemo(() => {
    if (!animationTimeline) return -1;
    const activeFrameId =
      animationPlaybackFrameId ?? animationTimeline.currentFrameId;
    return animationTimeline.frames.findIndex(
      (frame) => frame.id === activeFrameId
    );
  }, [animationPlaybackFrameId, animationTimeline]);

  if (canvasMode !== "animation" || !animationTimeline) {
    return null;
  }

  const toggleGhost = () => {
    const current = animationTimeline.onionSkin;
    if (current.enabled) {
      setOnionSkinSettings({ enabled: false });
      return;
    }

    const shouldRestoreDefaults =
      current.backwardLayers === 0 &&
      current.forwardLayers === 0;

    setOnionSkinSettings({
      enabled: true,
      ...(shouldRestoreDefaults
        ? {
            backwardLayers: DEFAULT_GHOST_SETTINGS.backwardLayers,
            forwardLayers: DEFAULT_GHOST_SETTINGS.forwardLayers,
            opacityFalloff: [...DEFAULT_GHOST_SETTINGS.opacityFalloff],
          }
        : {}),
    });
  };

  const timelineContent = (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-1.5 p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                tone="subtle"
                shape="square"
                size="md"
                className={uiClass.hostIconControl}
                aria-label="Previous frame"
                onClick={() => stepAnimationFrame(-1)}
              >
                <PreviousFrameIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Previous frame</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                tone="subtle"
                shape="square"
                size="md"
                className={cn(
                  uiClass.hostIconControl,
                  animationIsPlaying && uiClass.hostControlActive
                )}
                aria-label={animationIsPlaying ? "Pause animation" : "Play animation"}
                onClick={() =>
                  animationIsPlaying ? pauseAnimation() : playAnimation()
                }
              >
                {animationIsPlaying ? (
                  <PauseIcon className="size-4" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {animationIsPlaying ? "Pause" : "Play"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                tone="subtle"
                shape="square"
                size="md"
                className={uiClass.hostIconControl}
                aria-label="Next frame"
                onClick={() => stepAnimationFrame(1)}
              >
                <NextFrameIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Next frame</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                tone="subtle"
                shape="square"
                size="md"
                className={cn(
                  uiClass.hostIconControl,
                  animationTimeline.loop && uiClass.hostControlActive
                )}
                aria-label="Toggle animation loop"
                onClick={toggleAnimationLoop}
              >
                <LoopIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {animationTimeline.loop ? "Loop on" : "Loop off"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="px-2 py-2 text-xs font-semibold text-foreground">
          {Math.max(activeFrameIndex + 1, 1)} / {animationTimeline.frames.length}
        </div>

        <div className="flex items-center gap-1 p-1">
          <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Ghost
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="switch"
                aria-checked={animationTimeline.onionSkin.enabled}
                aria-label="Toggle onion skin"
                onClick={toggleGhost}
                className={cn(
                  "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors",
                  animationTimeline.onionSkin.enabled
                    ? "border-primary bg-primary/70"
                    : "border-border bg-background hover:bg-accent/55"
                )}
              >
                <span
                  className={cn(
                    "ml-0.5 size-5 rounded-full border border-border bg-background transition-transform",
                    animationTimeline.onionSkin.enabled && "translate-x-4"
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Onion skin</TooltipContent>
          </Tooltip>
        </div>

        <label className="flex items-center gap-2 px-2 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            FPS
          </span>
          <Input
            value={String(animationTimeline.fps)}
            inputMode="numeric"
            onChange={(event) =>
              setAnimationFps(Number.parseInt(event.target.value || "0", 10))
            }
            className="h-6 w-12 border-none bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
          />
        </label>
      </div>
  );

  return timelineContent;
}

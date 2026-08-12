type DockShortcutPlatform = "mac" | "other";

export type DockShortcutEvent = Pick<KeyboardEvent, "code"> &
  Partial<
    Pick<
      KeyboardEvent,
      | "altKey"
      | "ctrlKey"
      | "defaultPrevented"
      | "isComposing"
      | "metaKey"
      | "repeat"
      | "shiftKey"
    >
  >;

const getDockShortcutPlatform = (): DockShortcutPlatform => {
  if (typeof navigator === "undefined") return "other";
  const platform = navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform) ? "mac" : "other";
};

export const resolveDockShortcutIndex = (
  event: DockShortcutEvent,
  itemCount: number,
  platform = getDockShortcutPlatform()
): number | null => {
  const hasPlatformModifier =
    platform === "mac"
      ? !!event.ctrlKey && !event.altKey
      : !!event.altKey && !event.ctrlKey;
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    !hasPlatformModifier ||
    event.metaKey ||
    event.shiftKey
  ) {
    return null;
  }

  const match = /^Digit([1-9])$/.exec(event.code);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return index < itemCount ? index : null;
};

export const getDockShortcutAriaLabel = (
  index: number,
  platform = getDockShortcutPlatform()
) => `${platform === "mac" ? "Control" : "Alt"}+${index + 1}`;

export const getDockShortcutLabel = (
  index: number,
  platform = getDockShortcutPlatform()
) =>
  platform === "mac"
    ? `⌃${index + 1}`
    : getDockShortcutAriaLabel(index, platform);

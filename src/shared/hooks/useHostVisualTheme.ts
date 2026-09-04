import { useLayoutEffect, useState, type RefObject } from "react";
import {
  readUiRuntimeTheme,
  useUiTheme,
  type UiRuntimeTheme,
} from "@chardesk/ui";

export type HostVisualTheme = UiRuntimeTheme & {
  revision: string;
};

export function useHostVisualTheme(ref: RefObject<HTMLElement | null>) {
  const { resolvedTheme } = useUiTheme();
  const [visualTheme, setVisualTheme] = useState<HostVisualTheme | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !resolvedTheme) return;
    setVisualTheme({
      ...readUiRuntimeTheme(element),
      revision: resolvedTheme,
    });
  }, [ref, resolvedTheme]);

  return visualTheme;
}

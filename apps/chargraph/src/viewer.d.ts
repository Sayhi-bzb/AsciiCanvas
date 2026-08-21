import type { CharDeskViewerElement } from "@chardesk/viewer";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "chardesk-viewer": DetailedHTMLProps<
        HTMLAttributes<CharDeskViewerElement>,
        CharDeskViewerElement
      > & {
        controls?: "true" | "false";
        fit?: "none" | "width" | "contain";
        interaction?: "grid" | "text";
        syntax?: "auto" | "plain" | "ansi";
      };
    }
  }
}

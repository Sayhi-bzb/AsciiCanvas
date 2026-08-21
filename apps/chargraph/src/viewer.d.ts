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
        interaction?: "grid" | "text";
        syntax?: "auto" | "plain" | "ansi";
      };
    }
  }
}

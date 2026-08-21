"use client";

import { useUiI18n } from "@/shared/i18n";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@chardesk/ui";
import { useCanvasState } from "@/domains/canvas/public";

type DataSecurityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DataSecurityDialog({
  open,
  onOpenChange,
}: DataSecurityDialogProps) {
  const { t } = useUiI18n();
  const collaboration = useCanvasState((state) =>
    state.canvasSessions.find((session) => session.id === state.activeCanvasId)?.collaboration
  );
  const collaborationDisclosure = collaboration
    ? collaboration.provider === "p2p"
      ? [t("security.p2p.title"), t("security.p2p.description")] as const
      : [t("security.byos.title"), t("security.byos.description")] as const
    : null;
  const disclosures = collaborationDisclosure
    ? [
        ["local", t("security.local.title"), t("security.local.description")],
        ["room", collaborationDisclosure[0], collaborationDisclosure[1]],
      ] as const
    : [
        ["local", t("security.local.title"), t("security.local.description")],
        ["private", t("security.private.title"), t("security.private.description")],
        ["control", t("security.control.title"), t("security.control.description")],
      ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("security.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
            {disclosures.map(([key, title, description]) => (
              <div key={key} className="contents">
                <dt className="font-medium text-foreground">{title}</dt>
                <dd className="leading-5 text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] leading-4 text-muted-foreground">
            {collaboration ? t("security.collaborationNote") : t("security.storageNote")}
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

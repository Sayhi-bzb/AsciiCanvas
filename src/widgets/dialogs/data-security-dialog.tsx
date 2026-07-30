"use client";

import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useUiI18n } from "@/shared/i18n";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useEditorStore } from "@/domains/canvas/public";

const SecurityIcon = HOST_ICONOLOGY.viewportAction.security;

type DataSecurityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DataSecurityDialog({
  open,
  onOpenChange,
}: DataSecurityDialogProps) {
  const { t } = useUiI18n();
  const collaboration = useEditorStore((state) =>
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
          <DialogTitle className="flex items-center gap-2">
            <SecurityIcon className="size-5 text-primary" />
            <span>{t("security.title")}</span>
          </DialogTitle>
          <DialogDescription>{t("security.summary")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {disclosures.map(([key, title, description]) => (
            <section key={key} className="rounded-md bg-accent/40 p-3">
              <h3 className="text-xs font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </section>
          ))}
          <p className="text-[11px] leading-4 text-muted-foreground">
            {collaboration ? t("security.collaborationNote") : t("security.storageNote")}
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

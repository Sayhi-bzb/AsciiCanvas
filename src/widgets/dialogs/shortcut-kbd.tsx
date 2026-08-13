import {
  formatShortcutLabel,
  getShortcutDisplayTokens,
} from "@/domains/actions/public";
import { Kbd, KbdGroup } from "@/shared/ui/kbd";

type ShortcutKbdProps = {
  shortcut: string;
  className?: string;
};

export function ShortcutKbd({ shortcut, className }: ShortcutKbdProps) {
  return (
    <KbdGroup className={className} aria-label={formatShortcutLabel(shortcut)}>
      {getShortcutDisplayTokens(shortcut).map((token, index) => (
        <Kbd key={`${token}-${index}`}>{token}</Kbd>
      ))}
    </KbdGroup>
  );
}

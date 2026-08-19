import { formatShortcutLabel, getShortcutDisplayStrokes } from '@/domains/actions/public';
import type { ShortcutSequence } from '@/domains/editor/public';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';

type ShortcutKbdProps = {
  shortcut: ShortcutSequence | string;
  className?: string;
  invalid?: boolean;
};

export function ShortcutKbd({ shortcut, className, invalid = false }: ShortcutKbdProps) {
  return (
    <KbdGroup
      className={className}
      aria-invalid={invalid || undefined}
      aria-label={formatShortcutLabel(shortcut)}
    >
      {getShortcutDisplayStrokes(shortcut).map((stroke, index) => (
        <span key={`${stroke.label}-${index}`} className="contents">
          {index > 0 ? (
            <span aria-hidden="true" className="text-muted-foreground">
              +
            </span>
          ) : null}
          <Kbd
            aria-hidden="true"
            className={invalid ? 'bg-destructive/10 text-destructive' : undefined}
          >
            {stroke.label}
          </Kbd>
        </span>
      ))}
    </KbdGroup>
  );
}

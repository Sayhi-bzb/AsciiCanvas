import type { LucideIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { SelectableItem } from '@/shared/ui/selectable-item';

type SettingsNavigationItem<Value extends string> = {
  value: Value;
  title: string;
  icon: LucideIcon;
};

type SettingsNavigationProps<Value extends string> = {
  label: string;
  items: readonly SettingsNavigationItem<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
};

export function SettingsNavigation<Value extends string>({
  label,
  items,
  value,
  onValueChange,
}: SettingsNavigationProps<Value>) {
  return (
    <>
      <div data-slot="settings-navigation-mobile" className="p-1 md:hidden [&_svg]:size-[1em]!">
        <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as Value)}>
          <SelectTrigger className="w-full sm:w-44" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" position="popper">
            <SelectGroup>
              {items.map(({ icon: Icon, title, value: itemValue }) => (
                <SelectItem key={itemValue} value={itemValue}>
                  <Icon />
                  {title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div
        data-slot="settings-navigation-inline"
        className="hidden min-w-0 px-1 py-2 md:block [&_svg]:size-[1em]!"
      >
        <nav
          aria-label={label}
          className="flex min-w-0 flex-nowrap gap-2 py-1 lg:flex-col lg:gap-1"
        >
          {items.map(({ icon: Icon, title, value: itemValue }) => (
            <SelectableItem
              key={itemValue}
              type="button"
              selected={value === itemValue}
              aria-current={value === itemValue ? 'page' : undefined}
              className="min-w-0 justify-start [&_svg]:shrink-0 lg:w-full"
              onClick={() => onValueChange(itemValue)}
            >
              <Icon />
              <span className="truncate">{title}</span>
            </SelectableItem>
          ))}
        </nav>
      </div>
    </>
  );
}

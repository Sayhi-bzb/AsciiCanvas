import type { ReactNode } from 'react';

type SettingsContentSectionProps = {
  heading: string;
  children: ReactNode;
};

export function SettingsContentSection({ heading, children }: SettingsContentSectionProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h2 className="shrink-0 whitespace-nowrap pe-8 text-sm font-semibold">{heading}</h2>
      <div className="mt-4 min-h-0 w-full flex-1 overflow-auto pe-1">
        <div className="min-w-max lg:min-w-full">{children}</div>
      </div>
    </section>
  );
}

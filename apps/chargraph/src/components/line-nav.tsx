/**
 * This component is inspired by Devouring Details and Skiper UI.
 */

import { memo, useEffect, useRef } from "react";
import type {
  ComponentProps,
  CSSProperties,
  MouseEvent,
  MouseEventHandler,
  Ref,
} from "react";
import { motion } from "motion/react";

import { cn } from "@chardesk/ui";

const NORMAL_LINE_WIDTH = 24;
const EXPANDED_LINE_WIDTH = 40;

const lineVariants = {
  normal: { scaleX: NORMAL_LINE_WIDTH / EXPANDED_LINE_WIDTH },
  active: { scaleX: 1 },
  hover: { scaleX: 1 },
};

export type LineNavItem = {
  title: string;
  href: string;
};

export type LineNavProps = Omit<ComponentProps<"nav">, "children"> & {
  items: LineNavItem[];
  activeHref?: string;
  scrollActiveIntoView?: boolean;
  onItemClick?: (
    item: LineNavItem,
    event: MouseEvent<HTMLAnchorElement>
  ) => void;
};

export function LineNav({
  className,
  style,
  items,
  activeHref,
  scrollActiveIntoView = true,
  onItemClick,
  ...props
}: LineNavProps) {
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (scrollActiveIntoView) {
      activeItemRef.current?.scrollIntoView({ block: "center" });
    }
  }, [scrollActiveIntoView]);

  return (
    <nav
      data-slot="line-nav"
      className={cn("flex flex-col gap-2 py-5.25", className)}
      style={
        {
          ...style,
          "--line-nav-width": `${NORMAL_LINE_WIDTH}px`,
        } as CSSProperties
      }
      {...props}
    >
      {items.map((item, index) => {
        const isActive = item.href === activeHref;

        return (
          <LineNavEntry
            key={item.href}
            ref={isActive ? activeItemRef : undefined}
            title={item.title}
            href={item.href}
            active={isActive}
            isLast={index === items.length - 1}
            onClick={
              onItemClick ? (event) => onItemClick(item, event) : undefined
            }
          />
        );
      })}
    </nav>
  );
}

const LineNavEntry = memo(function LineNavEntry({
  ref,
  title,
  href,
  active = false,
  isLast = false,
  onClick,
}: {
  ref?: Ref<HTMLAnchorElement>;
  title: string;
  href: string;
  active?: boolean;
  isLast?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <>
      <motion.a
        ref={ref}
        data-slot="line-nav-item"
        aria-current={active ? "page" : undefined}
        className="group relative flex h-px items-center gap-3 after:absolute after:top-1/2 after:left-0 after:size-full after:-translate-y-1/2 after:p-3.5"
        href={href}
        initial={false}
        animate={active ? "active" : "normal"}
        whileHover="hover"
        onClick={onClick}
      >
        <motion.span
          data-slot="line-nav-marker"
          className="block h-px w-10 origin-left shrink-0 bg-foreground/20 transition-[background-color] ease-out group-hover:bg-foreground group-aria-[current=page]:bg-foreground"
          variants={lineVariants}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        />
        <span className="text-sm whitespace-nowrap text-muted-foreground transition-[color] ease-out group-hover:text-foreground group-aria-[current=page]:text-foreground">
          {title}
        </span>
      </motion.a>

      {!isLast ? (
        <>
          <span className="block h-px w-(--line-nav-width) bg-foreground/20" />
          <span className="block h-px w-(--line-nav-width) bg-foreground/20" />
        </>
      ) : null}
    </>
  );
});

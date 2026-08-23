"use client";

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import {
  PageFrame,
  PageShell,
  StripeDivider,
  buttonVariants,
} from "@chardesk/ui";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { Container as FumadocsContainer } from "fumadocs-ui/layouts/docs/slots/container";

const GITHUB_URL = "https://github.com/Sayhi-bzb/CharDesk";

function DocsHeaderFrame({ controls }: { controls?: ReactNode }) {
  return (
    <PageFrame
      as="header"
      bleed
      boundaries="start"
      data-frame="header"
      className="mx-auto flex h-12 w-full max-w-[97rem] items-center gap-2 px-4 sm:px-6"
    >
      <a href="/docs/" className="text-sm font-medium">
        CharDesk Docs
      </a>
      <nav
        aria-label="Primary"
        className="ml-auto hidden items-center gap-4 text-sm text-muted-foreground md:flex"
      >
        <a className="transition-colors hover:text-foreground" href="/">
          CharDesk
        </a>
        <a
          className="transition-colors hover:text-foreground"
          href="/chargraph/"
        >
          CharGraph
        </a>
        <a
          className="transition-colors hover:text-foreground"
          href={GITHUB_URL}
        >
          GitHub
        </a>
      </nav>
      {controls}
    </PageFrame>
  );
}

function DocsSiteHeader() {
  const { slots } = useDocsLayout();
  const SearchTrigger = slots.searchTrigger ? slots.searchTrigger.sm : null;
  const SidebarTrigger = slots.sidebar?.trigger ?? null;

  return (
    <DocsHeaderFrame
      controls={
        <>
          {SearchTrigger ? (
            <SearchTrigger hideIfDisabled className="ml-auto md:hidden" />
          ) : null}
          {SidebarTrigger ? (
            <SidebarTrigger
              type="button"
              aria-label="Open documentation navigation"
              className={buttonVariants({
                tone: "subtle",
                size: "md",
                shape: "square",
                className: "md:hidden",
              })}
            >
              <PanelLeft aria-hidden="true" />
            </SidebarTrigger>
          ) : null}
        </>
      }
    />
  );
}

function DocsSiteFooter() {
  return (
    <PageFrame
      as="footer"
      bleed
      boundaries="end"
      data-frame="footer"
      className="mx-auto flex h-14 w-full max-w-[97rem] shrink-0 items-center gap-2 px-4 text-sm text-muted-foreground sm:px-6"
    >
      <p>CharDesk Docs · CharDesk</p>
      <a
        className="ml-auto transition-colors hover:text-foreground"
        href={GITHUB_URL}
      >
        GitHub
      </a>
    </PageFrame>
  );
}

function DocsShellContainer({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <PageShell>
      <DocsSiteHeader />
      <StripeDivider
        bleed
        className="mx-auto w-full max-w-[97rem] border-x border-separator"
      />
      <PageFrame
        boundaries="none"
        data-frame="content"
        className="mx-auto w-full max-w-[97rem] flex-1"
      >
        <FumadocsContainer
          {...props}
          className={className}
          style={
            {
              "--fd-docs-height": "calc(100dvh - 10.5rem)",
              ...props.style,
            } as CSSProperties
          }
        >
          {children}
        </FumadocsContainer>
      </PageFrame>
      <StripeDivider
        bleed
        className="mx-auto w-full max-w-[97rem] border-x border-separator"
      />
      <DocsSiteFooter />
    </PageShell>
  );
}

function DocsErrorShell({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <DocsHeaderFrame />
      <StripeDivider
        bleed
        className="mx-auto w-full max-w-[97rem] border-x border-separator"
      />
      <PageFrame
        as="main"
        boundaries="none"
        className="mx-auto flex w-full max-w-[97rem] flex-1 items-center"
      >
        {children}
      </PageFrame>
      <StripeDivider
        bleed
        className="mx-auto w-full max-w-[97rem] border-x border-separator"
      />
      <DocsSiteFooter />
    </PageShell>
  );
}

export { DocsErrorShell, DocsShellContainer };

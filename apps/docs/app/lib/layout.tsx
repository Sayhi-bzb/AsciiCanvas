import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      enabled: false,
      title: "CharDesk Docs",
    },
    githubUrl: "https://github.com/Sayhi-bzb/CharDesk",
    links: [
      {
        text: "Open CharDesk",
        url: "/",
        external: true,
      },
    ],
  };
}

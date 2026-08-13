import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
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

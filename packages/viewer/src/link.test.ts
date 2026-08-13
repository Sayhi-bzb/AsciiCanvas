import { describe, expect, it } from "vitest";
import { sanitizeCharDeskHref } from "./link.js";

describe("sanitizeCharDeskHref", () => {
  it.each([
    "https://chardesk.com/docs",
    "http://localhost:5173",
    "mailto:hello@chardesk.com",
    "#section",
    "/docs/viewer",
    "../viewer",
  ])("accepts %s", (href) => {
    expect(sanitizeCharDeskHref(href)).toBe(href);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "vbscript:unsafe",
    "bare-host.example",
    "",
  ])("rejects %s", (href) => {
    expect(sanitizeCharDeskHref(href)).toBeNull();
  });
});

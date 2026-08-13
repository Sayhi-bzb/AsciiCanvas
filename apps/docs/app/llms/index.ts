import { llms } from "fumadocs-core/source";
import { publicDevelopmentSource } from "@/lib/source";

export function loader() {
  const index = llms(publicDevelopmentSource)
    .index()
    .replace(/^# Docs/, "# CharDesk Development Documentation");

  return new Response(index, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

import { createFromSource } from "fumadocs-core/search/server";
import { developmentSource } from "@/lib/source";

const search = createFromSource(developmentSource, {
  language: "english",
});

export async function loader() {
  return search.staticGET();
}

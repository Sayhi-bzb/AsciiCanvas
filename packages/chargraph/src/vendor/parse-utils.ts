// @ts-nocheck -- pinned upstream source; validated at the package boundary.

/** Normalize Mermaid source before diagram-specific parsing. */
export function prepareMermaidLines(text: string): string[] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
  const rawLines = source.split("\n")
  const firstContent = rawLines.find(line => line.trim().length > 0)?.trim()
  if (firstContent === "---") {
    throw new Error("Mermaid frontmatter is not supported")
  }

  return rawLines.flatMap(splitStatements).map(line => line.trim()).filter(
    line => line.length > 0 && !line.startsWith("%%"),
  )
}

/** Split Mermaid's optional semicolon statements without splitting labels. */
function splitStatements(line: string): string[] {
  const statements: string[] = []
  let start = 0
  let quote: '"' | "'" | null = null
  let square = 0
  let round = 0
  let curly = 0

  for (let index = 0; index < line.length; index++) {
    const char = line[index]!
    const previous = line[index - 1]
    if (quote) {
      if (char === quote && previous !== "\\") quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === "[") square++
    else if (char === "]") square = Math.max(0, square - 1)
    else if (char === "(") round++
    else if (char === ")") round = Math.max(0, round - 1)
    else if (char === "{") curly++
    else if (char === "}") curly = Math.max(0, curly - 1)
    else if (char === ";" && square === 0 && round === 0 && curly === 0) {
      statements.push(line.slice(start, index))
      start = index + 1
    }
  }
  statements.push(line.slice(start))
  return statements
}

// @ts-nocheck -- pinned upstream source; validated at the package boundary.
// ============================================================================
// beautiful-mermaid — ASCII renderer public API
//
// Renders Mermaid diagrams to ASCII or Unicode box-drawing art.
// No external dependencies — pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts and state diagrams — ELK Layered projected onto Unicode cells
//   - State diagrams (stateDiagram-v2) — same pipeline as flowcharts
//   - Sequence diagrams (sequenceDiagram) — column-based timeline layout
//   - Class diagrams (classDiagram) — ELK layered UML layout
//   - ER diagrams (erDiagram) — grid layout with crow's foot notation
//
// Usage:
//   import { renderMermaidASCII } from 'beautiful-mermaid'
//   const ascii = renderMermaidASCII('graph LR\n  A --> B')
// ============================================================================

import { parseMermaid } from '../parser.js'
import { renderLayeredMermaid } from '../../layout/mermaid.js'
import { renderLayeredClass } from '../../layout/class.js'
import { renderLayeredEr } from '../../layout/er.js'
import { renderSequenceAscii } from './sequence.js'
import { renderXYChartAscii } from './xychart.js'
import type { AsciiConfig } from './types.js'

interface AsciiRenderOptions {
  /** true = ASCII chars (+,-,|,>), false = Unicode box-drawing (┌,─,│,►). Default: false */
  useAscii?: boolean
  /** Horizontal spacing between nodes. Default: 3 for Flow/State/Class; 5 elsewhere */
  paddingX?: number
  /** Vertical spacing between nodes. Default: 1 for Flow/State, 3 for Class, 5 elsewhere */
  paddingY?: number
  /** Padding inside node boxes. Default: 0 for Flow/State; 1 elsewhere */
  boxBorderPadding?: number
}

/**
 * Detect the diagram type from the mermaid source text.
 * Mirrors the detection logic in src/index.ts for the SVG renderer.
 */
function detectDiagramType(text: string): 'flowchart' | 'sequence' | 'class' | 'er' | 'xychart' {
  const firstLine = text.trim().split('\n')[0]?.trim().toLowerCase() ?? ''

  if (/^xychart(-beta)?\b/.test(firstLine)) return 'xychart'
  if (/^sequencediagram\s*$/.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/.test(firstLine)) return 'er'

  // Default: flowchart/state (handled by parseMermaid internally)
  return 'flowchart'
}

/**
 * Render Mermaid diagram text to an ASCII/Unicode string.
 *
 * Flow and state diagrams are asynchronous because ELK runs in a browser worker.
 * Auto-detects diagram type from the header line and dispatches to
 * the appropriate renderer.
 *
 * @param text - Mermaid source text (any supported diagram type)
 * @param options - Rendering options
 * @returns Multi-line ASCII/Unicode string
 *
 * @example
 * ```ts
 * const result = renderMermaidAscii(`
 *   graph LR
 *     A --> B --> C
 * `, { useAscii: true })
 *
 * // Output:
 * // +---+     +---+     +---+
 * // |   |     |   |     |   |
 * // | A |---->| B |---->| C |
 * // |   |     |   |     |   |
 * // +---+     +---+     +---+
 * ```
 */
export async function renderMermaidASCII(
  text: string,
  options: AsciiRenderOptions = {},
): string {
  const config: AsciiConfig = {
    useAscii: options.useAscii ?? false,
    paddingX: options.paddingX ?? 5,
    paddingY: options.paddingY ?? 5,
    boxBorderPadding: options.boxBorderPadding ?? 1,
    graphDirection: 'TD', // default, overridden for flowcharts below
  }

  const diagramType = detectDiagramType(text)

  switch (diagramType) {
    case 'xychart':
      return renderXYChartAscii(text, config)

    case 'sequence':
      return renderSequenceAscii(text, config)

    case 'class':
      return renderLayeredClass(text, {
        ...config,
        paddingX: options.paddingX ?? 3,
        paddingY: options.paddingY ?? 3,
      })

    case 'er':
      return renderLayeredEr(text, config)

    case 'flowchart':
    default: {
      // Flowchart + state diagram pipeline (original)
      const parsed = parseMermaid(text)
      const explicitBoxPadding = options.boxBorderPadding

      return renderLayeredMermaid(parsed, {
        ...config,
        paddingX: options.paddingX ?? 3,
        paddingY: options.paddingY ?? 1,
        boxBorderPadding: explicitBoxPadding ?? 0,
        boxBorderPaddingX: explicitBoxPadding ?? 1,
        boxBorderPaddingY: explicitBoxPadding ?? 0,
      })
    }
  }
}

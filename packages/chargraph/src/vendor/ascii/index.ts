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
import { renderLayeredMermaidSurface } from '../../layout/mermaid.js'
import { renderLayeredClassSurface } from '../../layout/class.js'
import { renderLayeredErSurface } from '../../layout/er.js'
import { renderSequenceSurface } from './sequence.js'
import { renderXYChartSurface } from './xychart.js'
import { surfaceToString } from './surface.js'
import type { AsciiRenderSurface } from './types.js'
import type { AsciiConfig } from './types.js'
import { prepareMermaidLines } from '../parse-utils.js'

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
  const firstLine = prepareMermaidLines(text)[0]?.toLowerCase() ?? ''

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
  return surfaceToString(await renderMermaidSurface(text, options))
}

export async function renderMermaidSurface(
  text: string,
  options: AsciiRenderOptions = {},
): Promise<AsciiRenderSurface> {
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
      return renderXYChartSurface(text, config)

    case 'sequence':
      return renderSequenceSurface(text, config)

    case 'class':
      return renderLayeredClassSurface(text, {
        ...config,
        paddingX: options.paddingX ?? 3,
        paddingY: options.paddingY ?? 3,
      })

    case 'er':
      return renderLayeredErSurface(text, config)

    case 'flowchart':
    default: {
      // Flowchart + state diagram pipeline (original)
      const parsed = parseMermaid(text)
      const explicitBoxPadding = options.boxBorderPadding

      return renderLayeredMermaidSurface(parsed, {
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

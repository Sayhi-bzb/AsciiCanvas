// @ts-nocheck -- pinned upstream source; validated at the package boundary.
import type { MermaidGraph, MermaidNode, MermaidEdge, MermaidSubgraph, Direction, NodeShape, EdgeStyle, EdgeMarker } from './types.js'
import { normalizeBrTags } from './multiline-utils.js'
import { prepareMermaidLines } from './parse-utils.js'

// ============================================================================
// Mermaid parser — flowcharts and state diagrams
//
// Supports:
//   Flowcharts: graph TD / flowchart LR
//   State diagrams: stateDiagram-v2
//
// Line-by-line regex approach — the grammar is regular enough
// that we don't need a grammar generator or full parser combinator.
// ============================================================================

/**
 * Parse Mermaid text into a logical graph structure.
 * Auto-detects diagram type (flowchart or state diagram).
 * Throws on invalid/unsupported input.
 */
export function parseMermaid(text: string): MermaidGraph {
  const lines = prepareMermaidLines(text)

  if (lines.length === 0) {
    throw new Error('Empty mermaid diagram')
  }

  // Detect diagram type from header
  const header = lines[0]!

  // State diagram: "stateDiagram-v2" or "stateDiagram"
  if (/^stateDiagram(-v2)?\s*$/i.test(header)) {
    return parseStateDiagram(lines)
  }

  // Flowchart: "graph TD" or "flowchart LR"
  return parseFlowchart(lines)
}

// ============================================================================
// Flowchart parser
// ============================================================================

function parseFlowchart(lines: string[]): MermaidGraph {
  const headerMatch = lines[0]!.match(/^(?:graph|flowchart)\s+(TD|TB|LR|BT|RL)\s*$/i)
  if (!headerMatch) {
    throw new Error(`Invalid mermaid header: "${lines[0]}". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.`)
  }

  const direction = headerMatch[1]!.toUpperCase() as Direction

  const graph: MermaidGraph = {
    diagramType: 'flowchart',
    direction,
    nodes: new Map(),
    edges: [],
    subgraphs: [],
  }

  // Subgraph stack for nested subgraphs.
  const subgraphStack: MermaidSubgraph[] = []
  let generatedSubgraphId = 0
  const subgraphIds = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- classDef: `classDef name prop:val,prop:val` ---
    const classDefMatch = line.match(/^classDef\s+(\w+)\s+(.+)$/)
    if (classDefMatch) {
      throw new Error(`Unsupported Mermaid statement: "${line}"`)
    }

    // --- class assignment: `class A,B className` ---
    const classAssignMatch = line.match(/^class\s+([\w,-]+)\s+(\w+)$/)
    if (classAssignMatch) {
      throw new Error(`Unsupported Mermaid statement: "${line}"`)
    }

    // --- style statement: `style A,B fill:#f00,stroke:#333` ---
    const styleMatch = line.match(/^style\s+([\w,-]+)\s+(.+)$/)
    if (styleMatch) {
      throw new Error(`Unsupported Mermaid statement: "${line}"`)
    }

    // --- linkStyle: `linkStyle 0 stroke:#f00` or `linkStyle default stroke:#f00` ---
    const linkStyleMatch = line.match(/^linkStyle\s+(default|[\d,\s]+)\s+(.+)$/)
    if (linkStyleMatch) {
      throw new Error(`Unsupported Mermaid statement: "${line}"`)
    }

    // --- direction override inside subgraph: `direction LR` ---
    const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i)
    if (dirMatch && subgraphStack.length > 0) {
      throw new Error('Subgraph direction overrides are not supported')
    }

    // --- subgraph start: `subgraph Label` or `subgraph id [Label]` ---
    const subgraphMatch = line.match(/^subgraph\s+(.+)$/)
    if (subgraphMatch) {
      const rest = subgraphMatch[1]!.trim()
      // Check for "subgraph id [Label]" form
      // ID can contain hyphens (e.g. "us-east"), so use [\w-]+ not \w+
      const bracketMatch = rest.match(/^([\w-]+)\s*\[(.+)\]$/)
      let id: string
      let label: string
      if (bracketMatch) {
        id = bracketMatch[1]!
        label = normalizeBrTags(bracketMatch[2]!)
      } else {
        // Use the label text as id (slugified)
        label = normalizeBrTags(rest)
        const slug = rest.replace(/\s+/g, '_').replace(/[^\w]/g, '')
        id = slug || `_subgraph${++generatedSubgraphId}`
      }
      while (subgraphIds.has(id)) id = `${id}_${++generatedSubgraphId}`
      subgraphIds.add(id)
      const sg: MermaidSubgraph = { id, label, nodeIds: [], children: [] }
      subgraphStack.push(sg)
      continue
    }

    // --- subgraph end ---
    if (line === 'end') {
      const completed = subgraphStack.pop()
      if (!completed) throw new Error('Unexpected Mermaid subgraph end')
      if (subgraphStack.length > 0) {
        subgraphStack[subgraphStack.length - 1]!.children.push(completed)
      } else {
        graph.subgraphs.push(completed)
      }
      continue
    }

    // --- Edge/node definitions ---
    parseEdgeLine(line, graph, subgraphStack)
  }

  if (subgraphStack.length > 0) throw new Error('Unclosed Mermaid subgraph')
  const groupIds = new Set(graph.subgraphs.flatMap(flattenSubgraphIds))
  if (graph.edges.some(edge => groupIds.has(edge.source) || groupIds.has(edge.target))) {
    throw new Error('Edges connected directly to subgraphs are not supported')
  }
  if (graph.nodes.size === 0) throw new Error('Mermaid flowchart has no nodes')

  return graph
}

// ============================================================================
// State diagram parser
//
// Supported syntax:
//   stateDiagram-v2
//   s1 : Description
//   state "Description" as s1
//   s1 --> s2 : label
//   [*] --> s1            (start pseudostate)
//   s1 --> [*]            (end pseudostate)
//   state CompositeState {
//     inner1 --> inner2
//   }
// ============================================================================

function parseStateDiagram(lines: string[]): MermaidGraph {
  const graph: MermaidGraph = {
    diagramType: 'state',
    direction: 'TD',
    nodes: new Map(),
    edges: [],
    subgraphs: [],
  }

  // Track composite state nesting (like subgraphs)
  const compositeStack: MermaidSubgraph[] = []
  // Track all composite state IDs to avoid creating duplicate nodes
  const compositeStateIds = new Set<string>()
  // Counter for unique [*] pseudostate IDs
  let startCount = 0
  let endCount = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- direction override ---
    const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i)
    if (dirMatch) {
      if (compositeStack.length > 0) {
        compositeStack[compositeStack.length - 1]!.direction = dirMatch[1]!.toUpperCase() as Direction
      } else {
        graph.direction = dirMatch[1]!.toUpperCase() as Direction
      }
      continue
    }

    // --- linkStyle: `linkStyle 0 stroke:#f00` or `linkStyle default stroke:#f00` ---
    const linkStyleMatch = line.match(/^linkStyle\s+(default|[\d,\s]+)\s+(.+)$/)
    if (linkStyleMatch) {
      throw new Error(`Unsupported Mermaid statement: "${line}"`)
    }

    // --- composite state start: `state CompositeState {` ---
    const compositeMatch = line.match(/^state\s+(?:"([^"]+)"\s+as\s+)?([\w\p{L}]+)\s*\{$/u)
    if (compositeMatch) {
      const label = compositeMatch[1] ?? compositeMatch[2]!
      const id = compositeMatch[2]!
      const sg: MermaidSubgraph = { id, label, nodeIds: [], children: [] }
      compositeStack.push(sg)
      // Track this ID to avoid creating a duplicate node for the composite state
      compositeStateIds.add(id)
      // Remove any existing node that was created when parsing transitions before
      // this composite state definition (e.g., "A --> Processing" before "state Processing {")
      graph.nodes.delete(id)
      continue
    }

    // --- composite state end ---
    if (line === '}') {
      const completed = compositeStack.pop()
      if (completed) {
        if (compositeStack.length > 0) {
          compositeStack[compositeStack.length - 1]!.children.push(completed)
        } else {
          graph.subgraphs.push(completed)
        }
      }
      continue
    }

    // --- state alias: `state "Description" as s1` (without brace) ---
    const stateAliasMatch = line.match(/^state\s+"([^"]+)"\s+as\s+([\w\p{L}]+)\s*$/u)
    if (stateAliasMatch) {
      const label = normalizeBrTags(stateAliasMatch[1]!)
      const id = stateAliasMatch[2]!
      registerStateNode(graph, compositeStack, { id, label, shape: 'rounded' })
      continue
    }

    // --- transition: `s1 --> s2` or `s1 --> s2 : label` or `[*] --> s1` ---
    const transitionMatch = line.match(/^(\[\*\]|[\w\p{L}-]+)\s*(-->)\s*(\[\*\]|[\w\p{L}-]+)(?:\s*:\s*(.+))?$/u)
    if (transitionMatch) {
      let sourceId = transitionMatch[1]!
      let targetId = transitionMatch[3]!
      const rawTransitionLabel = transitionMatch[4]?.trim()
      const edgeLabel = rawTransitionLabel ? normalizeBrTags(rawTransitionLabel) : undefined

      // Handle [*] pseudostates — each occurrence gets a unique ID
      if (sourceId === '[*]') {
        startCount++
        sourceId = `_start${startCount > 1 ? startCount : ''}`
        registerStateNode(graph, compositeStack, { id: sourceId, label: '', shape: 'state-start' })
      } else if (!compositeStateIds.has(sourceId)) {
        // Only create a node if this isn't a composite state
        ensureStateNode(graph, compositeStack, sourceId)
      }

      if (targetId === '[*]') {
        endCount++
        targetId = `_end${endCount > 1 ? endCount : ''}`
        registerStateNode(graph, compositeStack, { id: targetId, label: '', shape: 'state-end' })
      } else if (!compositeStateIds.has(targetId)) {
        // Only create a node if this isn't a composite state
        ensureStateNode(graph, compositeStack, targetId)
      }

      graph.edges.push({
        source: sourceId,
        target: targetId,
        label: edgeLabel,
        style: 'solid',
        hasArrowStart: false,
        hasArrowEnd: true,
      })
      continue
    }

    // --- state description: `s1 : Description` ---
    const stateDescMatch = line.match(/^([\w\p{L}-]+)\s*:\s*(.+)$/u)
    if (stateDescMatch) {
      const id = stateDescMatch[1]!
      const label = normalizeBrTags(stateDescMatch[2]!.trim())
      registerStateNode(graph, compositeStack, { id, label, shape: 'rounded' })
      continue
    }

    throw new Error(`Unsupported Mermaid statement: "${line}"`)
  }

  if (compositeStack.length > 0) throw new Error('Unclosed composite state')
  if (graph.edges.some(edge => !graph.nodes.has(edge.source) || !graph.nodes.has(edge.target))) {
    throw new Error('Transitions connected directly to composite states are not supported')
  }
  if (graph.nodes.size === 0) throw new Error('Mermaid state diagram has no states')

  return graph
}

/** Register a state node and track in composite state if applicable */
function registerStateNode(
  graph: MermaidGraph,
  compositeStack: MermaidSubgraph[],
  node: MermaidNode
): void {
  const isNew = !graph.nodes.has(node.id)
  if (isNew) {
    graph.nodes.set(node.id, node)
  }
  if (compositeStack.length > 0) {
    const current = compositeStack[compositeStack.length - 1]!
    if (!current.nodeIds.includes(node.id)) {
      current.nodeIds.push(node.id)
    }
  }
}

/** Ensure a state node exists with default rounded shape */
function ensureStateNode(
  graph: MermaidGraph,
  compositeStack: MermaidSubgraph[],
  id: string
): void {
  if (!graph.nodes.has(id)) {
    registerStateNode(graph, compositeStack, { id, label: id, shape: 'rounded' })
  } else {
    // Track in composite if applicable
    if (compositeStack.length > 0) {
      const current = compositeStack[compositeStack.length - 1]!
      if (!current.nodeIds.includes(id)) {
        current.nodeIds.push(id)
      }
    }
  }
}

// ============================================================================
// Shared utilities
// ============================================================================

// ============================================================================
// Flowchart edge line parser
//
// Handles chained edges like: A[Label] --> B(Label) -.-> C{Label}
// Also handles & parallel links: A & B --> C & D
// ============================================================================

/**
 * Arrow regex — matches all arrow operators with optional labels.
 *
 * Supported operators:
 *   -->  ---       solid arrow / solid line
 *   -.-> -.-       dotted arrow / dotted line
 *   ==>  ===       thick arrow / thick line
 *   <--> <-.-> <==>  bidirectional variants
 *
 * Optional label: -->|label text|
 */
const ARROW_REGEX = /^(<|o|x)?(-{2,}|-\.+-|={2,})([>ox])?(?:\|([^|]*)\|)?/

/**
 * Text-embedded label regex — matches "-- label -->", "-. label .->", "== label ==>" syntax.
 * Tried as fallback when ARROW_REGEX doesn't match.
 *
 * Based on PR #36 by @liuxiaopai-ai (https://github.com/lukilabs/beautiful-mermaid/pull/36)
 */
const TEXT_ARROW_REGEX = /^(<)?(--|-\.|==)\s+(.+?)\s+(-->|---|\.\->|-\.\-|==>|===)/

/**
 * Node shape patterns — ordered from most specific delimiters to least.
 * Multi-char delimiters must be tried before single-char to avoid false matches.
 */
const NODE_PATTERNS: Array<{ regex: RegExp; shape: NodeShape }> = [
  // Triple delimiters (must be first)
  { regex: /^([^\s()[\]{}<>|&=:]+)\(\(\((.+?)\)\)\)/, shape: 'doublecircle' },  // A(((text)))

  // Double delimiters with mixed brackets
  { regex: /^([^\s()[\]{}<>|&=:]+)\(\[(.+?)\]\)/,     shape: 'stadium' },       // A([text])
  { regex: /^([^\s()[\]{}<>|&=:]+)\(\((.+?)\)\)/,     shape: 'circle' },        // A((text))
  { regex: /^([^\s()[\]{}<>|&=:]+)\[\[(.+?)\]\]/,     shape: 'subroutine' },    // A[[text]]
  { regex: /^([^\s()[\]{}<>|&=:]+)\[\((.+?)\)\]/,     shape: 'cylinder' },      // A[(text)]

  // Trapezoid variants — must come before plain [text]
  { regex: /^([^\s()[\]{}<>|&=:]+)\[\/(.+?)\\\]/,     shape: 'trapezoid' },     // A[/text\]
  { regex: /^([^\s()[\]{}<>|&=:]+)\[\\(.+?)\/\]/,     shape: 'trapezoid-alt' }, // A[\text/]

  // Asymmetric flag shape
  { regex: /^([^\s()[\]{}<>|&=:]+)>(.+?)\]/,          shape: 'asymmetric' },    // A>text]

  // Double curly braces (hexagon) — must come before single {text}
  { regex: /^([^\s()[\]{}<>|&=:]+)\{\{(.+?)\}\}/,     shape: 'hexagon' },       // A{{text}}

  // Single-char delimiters (last — most common, least specific)
  { regex: /^([^\s()[\]{}<>|&=:]+)\[(.+?)\]/,         shape: 'rectangle' },     // A[text]
  { regex: /^([^\s()[\]{}<>|&=:]+)\((.+?)\)/,         shape: 'rounded' },       // A(text)
  { regex: /^([^\s()[\]{}<>|&=:]+)\{(.+?)\}/,         shape: 'diamond' },       // A{text}
]

/** Regex for a bare node reference (just an ID, no shape brackets) */
const BARE_NODE_REGEX = /^([^\s()[\]{}<>|&=:]+?)(?=\s|:::|&|$|(?:-{2,}|-\.+-|={2,})|<(?=(?:-{2,}|-\.+-|={2,}))|-\.\s)/

/** Regex for ::: class shorthand suffix — matches :::className immediately after a node */
const CLASS_SHORTHAND_REGEX = /^:::([\w][\w-]*)/

/**
 * Parse a line that contains node definitions and edges.
 * Handles chaining: A --> B --> C produces edges A→B and B→C.
 * Handles parallel links: A & B --> C & D produces 4 edges.
 */
function parseEdgeLine(
  line: string,
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[]
): void {
  let remaining = line.trim()

  // Parse the first node group (possibly with & separators)
  const firstGroup = consumeNodeGroup(remaining, graph, subgraphStack)
  if (!firstGroup || firstGroup.ids.length === 0) {
    throw new Error(`Unsupported Mermaid statement: "${line}"`)
  }

  remaining = firstGroup.remaining.trim()
  let prevGroupIds = firstGroup.ids

  // Parse arrow + node-group pairs until the line is exhausted
  while (remaining.length > 0) {
    let hasArrowStart: boolean
    let style: EdgeStyle
    let hasArrowEnd: boolean
    let startMarker: EdgeMarker | undefined
    let endMarker: EdgeMarker | undefined
    let edgeLabel: string | undefined

    const textMatch = remaining.match(TEXT_ARROW_REGEX)
    if (textMatch) {
      hasArrowStart = Boolean(textMatch[1])
      startMarker = hasArrowStart ? 'arrow' : undefined
      const rawLabel = textMatch[3]!.trim()
      edgeLabel = rawLabel ? normalizeBrTags(rawLabel) : undefined
      const openOp = textMatch[2]!
      const closeOp = textMatch[4]!
      remaining = remaining.slice(textMatch[0].length).trim()
      style = textArrowStyleFromOps(openOp, closeOp)
      hasArrowEnd = closeOp.endsWith('>')
      endMarker = hasArrowEnd ? 'arrow' : undefined
    } else {
      const arrowMatch = remaining.match(ARROW_REGEX)
      if (!arrowMatch) throw new Error(`Unsupported Mermaid statement: "${line}"`)
      startMarker = markerFromToken(arrowMatch[1])
      hasArrowStart = startMarker === 'arrow'
      const arrowOp = arrowMatch[2]!
      endMarker = markerFromToken(arrowMatch[3])
      hasArrowEnd = endMarker === 'arrow'
      const rawEdgeLabel = arrowMatch[4]?.trim()
      edgeLabel = rawEdgeLabel ? normalizeBrTags(rawEdgeLabel) : undefined
      remaining = remaining.slice(arrowMatch[0].length).trim()
      style = arrowStyleFromOp(arrowOp)
    }

    // Parse the next node group
    const nextGroup = consumeNodeGroup(remaining, graph, subgraphStack)
    if (!nextGroup || nextGroup.ids.length === 0) {
      throw new Error(`Invalid Mermaid edge: "${line}"`)
    }

    remaining = nextGroup.remaining.trim()

    // Emit Cartesian product of edges: every source × every target
    for (const sourceId of prevGroupIds) {
      for (const targetId of nextGroup.ids) {
        graph.edges.push({
          source: sourceId,
          target: targetId,
          label: edgeLabel,
          style,
          hasArrowStart,
          hasArrowEnd,
          startMarker,
          endMarker,
        })
      }
    }

    prevGroupIds = nextGroup.ids
  }

  if (remaining.length > 0) throw new Error(`Unsupported Mermaid statement: "${line}"`)
}

function flattenSubgraphIds(group: MermaidSubgraph): string[] {
  return [group.id, ...group.children.flatMap(flattenSubgraphIds)]
}

interface ConsumedNodeGroup {
  ids: string[]
  remaining: string
}

/**
 * Consume one or more nodes separated by `&`.
 * E.g. "A & B & C --> ..." returns ids: ['A', 'B', 'C']
 */
function consumeNodeGroup(
  text: string,
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[]
): ConsumedNodeGroup | null {
  const first = consumeNode(text, graph, subgraphStack)
  if (!first) return null

  const ids = [first.id]
  let remaining = first.remaining.trim()

  // Check for & separators
  while (remaining.startsWith('&')) {
    remaining = remaining.slice(1).trim()
    const next = consumeNode(remaining, graph, subgraphStack)
    if (!next) break
    ids.push(next.id)
    remaining = next.remaining.trim()
  }

  return { ids, remaining }
}

interface ConsumedNode {
  id: string
  remaining: string
}

/**
 * Try to consume a node definition from the start of `text`.
 * If the node has a shape+label (e.g. A[Text]), it's registered in the graph.
 * If it's a bare reference (e.g. A), we look it up or create a default.
 * Also handles ::: class shorthand suffix.
 */
function consumeNode(
  text: string,
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[]
): ConsumedNode | null {
  let id: string | null = null
  let remaining: string = text

  const bareMatch = text.match(BARE_NODE_REGEX)
  const bareRemaining = bareMatch
    ? text.slice(bareMatch[0].length).trimStart()
    : ''
  // Connector grammar owns the boundary before visually ambiguous `>` shapes.
  const edgeNodeMatch = bareMatch && (
    ARROW_REGEX.test(bareRemaining) || TEXT_ARROW_REGEX.test(bareRemaining)
  ) ? bareMatch : null
  if (edgeNodeMatch) {
    id = edgeNodeMatch[1]!
    if (!graph.nodes.has(id)) {
      registerNode(graph, subgraphStack, { id, label: id, shape: 'rectangle' }, false)
    }
    remaining = text.slice(edgeNodeMatch[0].length)
  } else {
    // Try each node pattern (shape-qualified)
    for (const { regex, shape } of NODE_PATTERNS) {
      const match = text.match(regex)
      if (match) {
        id = match[1]!
        const label = normalizeBrTags(match[2]!)
        registerNode(graph, subgraphStack, { id, label, shape }, true)
        remaining = text.slice(match[0].length)
        break
      }
    }
  }

  // Bare node reference — only register if node doesn't exist yet.
  // If it already exists, do NOT track it in the current subgraph;
  // nodes belong to the subgraph where they're first defined.
  if (id === null) {
    const fallbackBareMatch = text.match(BARE_NODE_REGEX)
    if (fallbackBareMatch) {
      id = fallbackBareMatch[1]!
      if (!graph.nodes.has(id)) {
        registerNode(graph, subgraphStack, { id, label: id, shape: 'rectangle' }, false)
      }
      remaining = text.slice(fallbackBareMatch[0].length)
    }
  }

  if (id === null) return null

  // Check for ::: class shorthand suffix immediately after the node
  const classMatch = remaining.match(CLASS_SHORTHAND_REGEX)
  if (classMatch) {
    throw new Error(`Mermaid class shorthand is not supported: "${classMatch[0]}"`)
  }

  return { id, remaining }
}

/** Register a node in the graph and track it in the current subgraph */
function registerNode(
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[],
  node: MermaidNode,
  explicit: boolean,
): void {
  if (explicit || !graph.nodes.has(node.id)) {
    graph.nodes.set(node.id, node)
  }
  trackInSubgraph(subgraphStack, node.id)
}

/** Add node ID to the innermost subgraph if we're inside one */
function trackInSubgraph(subgraphStack: MermaidSubgraph[], nodeId: string): void {
  if (subgraphStack.length > 0) {
    const current = subgraphStack[subgraphStack.length - 1]!
    if (!current.nodeIds.includes(nodeId)) {
      current.nodeIds.push(nodeId)
    }
  }
}

/** Map arrow operator string to edge style (ignoring direction) */
function arrowStyleFromOp(op: string): EdgeStyle {
  if (op.includes('.')) return 'dotted'
  if (op.startsWith('=')) return 'thick'
  // '-->'' and '---' are both solid
  return 'solid'
}

function markerFromToken(token: string | undefined): EdgeMarker | undefined {
  if (token === '<' || token === '>') return 'arrow'
  if (token === 'o') return 'circle'
  if (token === 'x') return 'cross'
  return undefined
}

/** Map text-embedded arrow open/close operators to edge style */
function textArrowStyleFromOps(openOp: string, closeOp: string): EdgeStyle {
  if (openOp === '-.' || closeOp === '.->' || closeOp === '-.-') return 'dotted'
  if (openOp === '==' || closeOp === '==>' || closeOp === '===') return 'thick'
  return 'solid'
}

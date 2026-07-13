import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UNICODE_VERSION = "17.0.0";
const EMOJI_VERSION = "16.0";
const UCD_BASE_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`;
const EMOJI_TEST_URL = `https://www.unicode.org/Public/emoji/${EMOJI_VERSION}/emoji-test.txt`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const dataDir = path.join(repoRoot, "public", "data");

const OUTPUTS = {
  unicodeBlocks: path.join(dataDir, "unicode_blocks.json"),
  boxDrawing: path.join(dataDir, "box_drawing.json"),
  emojis: path.join(dataDir, "emojis_enriched.json"),
};

const INCLUDED_GENERAL_CATEGORIES = new Set([
  "Lu",
  "Ll",
  "Lt",
  "Lm",
  "Lo",
  "Nl",
  "Mn",
  "Mc",
  "Me",
  "Nd",
  "Pc",
  "Pd",
  "Ps",
  "Pe",
  "Pi",
  "Pf",
  "Po",
  "Sm",
  "Sc",
  "Sk",
  "So",
]);

const EXCLUDED_NAME_MARKERS = [
  "Control",
  "Noncharacter",
  "Surrogate",
  "Private Use",
];

function codePointToChar(codePoint) {
  return String.fromCodePoint(codePoint);
}

function formatBlockName(name) {
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function parseBlocks(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([0-9A-F]+)\.\.([0-9A-F]+);\s*(.+)$/);
      if (!match) {
        throw new Error(`Invalid Blocks.txt line: ${line}`);
      }

      return {
        start: Number.parseInt(match[1], 16),
        end: Number.parseInt(match[2], 16),
        name: match[3],
      };
    });
}

function parseUnicodeData(text) {
  const characters = new Map();

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const fields = line.split(";");
    const codePoint = Number.parseInt(fields[0], 16);
    const name = fields[1];
    const category = fields[2];

    if (!INCLUDED_GENERAL_CATEGORIES.has(category)) continue;
    if (EXCLUDED_NAME_MARKERS.some((marker) => name.includes(marker))) continue;

    characters.set(codePoint, { name, category });
  }

  return characters;
}

function buildUnicodeBlocks(blocks, characters) {
  const output = {};

  for (const block of blocks) {
    const chars = [];
    for (let codePoint = block.start; codePoint <= block.end; codePoint += 1) {
      const character = characters.get(codePoint);
      if (character) {
        chars.push({
          char: codePointToChar(codePoint),
          name: character.name,
        });
      }
    }

    if (chars.length > 0) {
      output[formatBlockName(block.name)] = chars;
    }
  }

  return output;
}

function buildBoxDrawing(blocks, characters) {
  const boxBlock = blocks.find((block) => block.name === "Box Drawing");
  if (!boxBlock) {
    throw new Error("Box Drawing block not found in Blocks.txt");
  }

  const chars = [];
  for (let codePoint = boxBlock.start; codePoint <= boxBlock.end; codePoint += 1) {
    const character = characters.get(codePoint);
    if (character) {
      chars.push({
        char: codePointToChar(codePoint),
        name: character.name,
      });
    }
  }

  return {
    "Box Drawing": chars,
  };
}

function parseEmojiTest(text) {
  const emojis = {};
  let group = "Ungrouped";
  let subgroup = "Other";

  for (const line of text.split(/\r?\n/)) {
    const groupMatch = line.match(/^# group:\s*(.+)$/);
    if (groupMatch) {
      group = groupMatch[1];
      emojis[group] ??= {};
      continue;
    }

    const subgroupMatch = line.match(/^# subgroup:\s*(.+)$/);
    if (subgroupMatch) {
      subgroup = subgroupMatch[1];
      emojis[group] ??= {};
      emojis[group][subgroup] ??= [];
      continue;
    }

    const emojiMatch = line.match(
      /^([0-9A-F ]+)\s*;\s*fully-qualified\s*#\s*\S+\s+E[0-9.]+\s+(.+)$/
    );
    if (!emojiMatch) continue;

    const char = emojiMatch[1]
      .trim()
      .split(/\s+/)
      .map((hex) => codePointToChar(Number.parseInt(hex, 16)))
      .join("");
    const name = emojiMatch[2].trim();

    emojis[group] ??= {};
    emojis[group][subgroup] ??= [];
    emojis[group][subgroup].push({ name, char });
  }

  return emojis;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const [blocksText, unicodeDataText, emojiTestText] = await Promise.all([
    fetchText(`${UCD_BASE_URL}/Blocks.txt`),
    fetchText(`${UCD_BASE_URL}/UnicodeData.txt`),
    fetchText(EMOJI_TEST_URL),
  ]);

  const blocks = parseBlocks(blocksText);
  const characters = parseUnicodeData(unicodeDataText);
  const unicodeBlocks = buildUnicodeBlocks(blocks, characters);
  const boxDrawing = buildBoxDrawing(blocks, characters);
  const emojis = parseEmojiTest(emojiTestText);

  await mkdir(dataDir, { recursive: true });
  await Promise.all([
    writeJson(OUTPUTS.unicodeBlocks, unicodeBlocks),
    writeJson(OUTPUTS.boxDrawing, boxDrawing),
    writeJson(OUTPUTS.emojis, emojis),
  ]);

  console.log(`Generated Unicode ${UNICODE_VERSION} character data.`);
  console.log(`Generated Emoji ${EMOJI_VERSION} data.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const outputRoot = path.join(repoRoot, "public", "fonts");
const manifestPath = path.join(outputRoot, "manifest.json");
const verifyOnly = process.argv.includes("--verify");
const browserUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "Chrome/138.0.0.0 Safari/537.36";

const sources = [
  {
    id: "maple-mono-nf-cn",
    family: "Maple Mono NF CN",
    version: "7.900",
    cssUrl: "https://fontsapi.zeoseven.com/442/main/result.css",
    versionMarker: "VersionString Version 7.900",
    licenseUrl:
      "https://raw.githubusercontent.com/subframe7536/maple-font/v7.9/OFL.txt",
  },
  {
    id: "noto-sans-symbols-2",
    family: "Noto Sans Symbols 2",
    version: "google-fonts-v25",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&display=swap",
    versionMarker: "/notosanssymbols2/v25/",
    licenseUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssymbols2/OFL.txt",
    headers: { "User-Agent": browserUserAgent },
  },
  {
    id: "noto-emoji",
    family: "Noto Emoji",
    version: "google-fonts-v62",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Emoji:wght@400&display=swap",
    versionMarker: "/notoemoji/v62/",
    licenseUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notoemoji/OFL.txt",
    headers: { "User-Agent": browserUserAgent },
  },
];

const sha256 = (content) =>
  createHash("sha256").update(content).digest("hex");

const fetchBytes = async (url, headers) => {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

const verifyAssets = async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const failures = [];

  for (const asset of manifest.assets) {
    const assetPath = path.join(outputRoot, asset.path);
    try {
      const content = await readFile(assetPath);
      if (content.length !== asset.size || sha256(content) !== asset.sha256) {
        failures.push(`${asset.path}: checksum mismatch`);
      }
    } catch {
      failures.push(`${asset.path}: missing`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Font asset verification failed:\n${failures.join("\n")}`);
  }
  console.log(`Verified ${manifest.assets.length} self-hosted font assets.`);
};

const vendorAssets = async () => {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: [],
    assets: [],
  };
  const stylesheets = [];

  for (const source of sources) {
    const sourceDir = path.join(outputRoot, source.id);
    await mkdir(sourceDir, { recursive: true });
    const cssBytes = await fetchBytes(source.cssUrl, source.headers);
    let css = cssBytes.toString("utf8");
    if (!css.includes(source.family) || !css.includes(source.versionMarker)) {
      throw new Error(
        `${source.id} no longer matches pinned version ${source.version}`
      );
    }

    const remoteUrls = [
      ...new Set(
        Array.from(
          css.matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/g),
          (match) => match[1].trim()
        )
      ),
    ];

    for (const remoteUrl of remoteUrls) {
      const absoluteUrl = new URL(remoteUrl, source.cssUrl).href;
      const fileName = path.basename(new URL(absoluteUrl).pathname);
      const relativePath = path.posix.join(source.id, fileName);
      const content = await fetchBytes(absoluteUrl, source.headers);
      await writeFile(path.join(outputRoot, relativePath), content);
      manifest.assets.push({
        path: relativePath,
        size: content.length,
        sha256: sha256(content),
      });
      css = css.replaceAll(remoteUrl, `./${relativePath}`);
    }

    // A locally installed font may be another version. Always use vendored bytes.
    css = css.replaceAll(/src:local\([^)]*\),/g, "src:");
    stylesheets.push(`/* ${source.family} ${source.version} */\n${css.trim()}`);

    const license = await fetchBytes(source.licenseUrl);
    const licensePath = path.posix.join(source.id, "OFL.txt");
    await writeFile(path.join(outputRoot, licensePath), license);
    manifest.assets.push({
      path: licensePath,
      size: license.length,
      sha256: sha256(license),
    });
    manifest.sources.push({
      id: source.id,
      family: source.family,
      version: source.version,
      stylesheet: source.cssUrl,
      stylesheetSha256: sha256(cssBytes),
      license: source.licenseUrl,
    });
  }

  const stylesheet = `${stylesheets.join("\n\n")}\n`;
  await writeFile(path.join(outputRoot, "fonts.css"), stylesheet, "utf8");
  manifest.assets.push({
    path: "fonts.css",
    size: Buffer.byteLength(stylesheet),
    sha256: sha256(stylesheet),
  });
  manifest.assets.sort((left, right) => left.path.localeCompare(right.path));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `Vendored ${manifest.assets.length - 4} font files from ${sources.length} pinned sources.`
  );
};

if (verifyOnly) {
  await verifyAssets();
} else {
  await vendorAssets();
  await verifyAssets();
}

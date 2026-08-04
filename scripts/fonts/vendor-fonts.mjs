import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const verifyOnly = process.argv.includes("--verify");
const browserUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "Chrome/138.0.0.0 Safari/537.36";

const targets = {
  "app-ui": {
    outputRoot: path.join(repoRoot, "public", "fonts"),
    assetPrefix: "",
  },
  canvas: {
    outputRoot: path.join(repoRoot, "packages", "fonts"),
    assetPrefix: "assets",
    profileId: "ascii-canvas/default-v1",
  },
};

const sources = [
  {
    target: "app-ui",
    id: "inter",
    family: "Inter",
    version: "google-fonts-v20",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
    versionMarker: "/inter/v20/",
    licenseUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt",
    headers: { "User-Agent": browserUserAgent },
  },
  {
    target: "app-ui",
    id: "noto-sans-sc",
    family: "Noto Sans SC",
    version: "google-fonts-v40",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&display=swap",
    versionMarker: "/notosanssc/v40/",
    licenseUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt",
    headers: { "User-Agent": browserUserAgent },
  },
  {
    target: "canvas",
    id: "maple-mono-nf-cn",
    family: "Maple Mono NF CN",
    version: "7.900",
    cssUrl: "https://fontsapi.zeoseven.com/442/main/result.css",
    versionMarker: "VersionString Version 7.900",
    licenseUrl:
      "https://raw.githubusercontent.com/subframe7536/maple-font/v7.9/OFL.txt",
  },
  {
    target: "canvas",
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
    target: "canvas",
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

const verifyTarget = async ([targetId, target]) => {
  const manifestPath = path.join(target.outputRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const failures = [];
  const expectedSourceIds = sources
    .filter((source) => source.target === targetId)
    .map((source) => source.id);

  if (manifest.target !== targetId) {
    failures.push(`manifest target: expected ${targetId}`);
  }
  if (target.profileId && manifest.profileId !== target.profileId) {
    failures.push(`manifest profile: expected ${target.profileId}`);
  }
  if (
    JSON.stringify(manifest.sources.map((source) => source.id)) !==
    JSON.stringify(expectedSourceIds)
  ) {
    failures.push(
      `manifest sources: expected ${expectedSourceIds.join(", ")}`
    );
  }

  for (const asset of manifest.assets) {
    const assetPath = path.join(target.outputRoot, asset.path);
    try {
      const content = await readFile(assetPath);
      if (content.length !== asset.size || sha256(content) !== asset.sha256) {
        failures.push(`${asset.path}: checksum mismatch`);
      }
    } catch {
      failures.push(`${asset.path}: missing`);
    }
  }

  const stylesheet = await readFile(
    path.join(target.outputRoot, "fonts.css"),
    "utf8"
  );
  if (/url\((?:["']?)https?:/u.test(stylesheet)) {
    failures.push("fonts.css: remote URL");
  }

  if (failures.length > 0) {
    throw new Error(
      `Font asset verification failed for ${targetId}:\n${failures.join("\n")}`
    );
  }
  console.log(
    `Verified ${manifest.assets.length} self-hosted ${targetId} font assets.`
  );
};

const verifyAssets = async () => {
  await Promise.all(Object.entries(targets).map(verifyTarget));
};

const vendorAssets = async () => {
  const manifests = new Map();
  const stylesheets = new Map();

  for (const [targetId, target] of Object.entries(targets)) {
    if (targetId === "app-ui") {
      await rm(target.outputRoot, { recursive: true, force: true });
    } else {
      await rm(path.join(target.outputRoot, target.assetPrefix), {
        recursive: true,
        force: true,
      });
      await rm(path.join(target.outputRoot, "fonts.css"), { force: true });
      await rm(path.join(target.outputRoot, "manifest.json"), { force: true });
    }
    await mkdir(
      path.join(target.outputRoot, target.assetPrefix),
      { recursive: true }
    );
    manifests.set(targetId, {
      target: targetId,
      ...(target.profileId ? { profileId: target.profileId } : {}),
      generatedAt: new Date().toISOString(),
      sources: [],
      assets: [],
    });
    stylesheets.set(targetId, []);
  }

  for (const source of sources) {
    const target = targets[source.target];
    const manifest = manifests.get(source.target);
    const targetStylesheets = stylesheets.get(source.target);
    const sourceRelativeDir = path.posix.join(target.assetPrefix, source.id);
    const sourceDir = path.join(target.outputRoot, sourceRelativeDir);
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
      const relativePath = path.posix.join(sourceRelativeDir, fileName);
      const content = await fetchBytes(absoluteUrl, source.headers);
      await writeFile(path.join(target.outputRoot, relativePath), content);
      manifest.assets.push({
        path: relativePath,
        size: content.length,
        sha256: sha256(content),
      });
      css = css.replaceAll(remoteUrl, `./${relativePath}`);
    }

    // A locally installed font may be another version. Always use vendored bytes.
    css = css.replaceAll(/src:local\([^)]*\),/g, "src:");
    targetStylesheets.push(
      `/* ${source.family} ${source.version} */\n${css.trim()}`
    );

    const rawLicense = await fetchBytes(source.licenseUrl);
    const license = Buffer.from(
      rawLicense.toString("utf8").replace(/[ \t]+(?=\r?\n)/g, "")
    );
    const licensePath = path.posix.join(sourceRelativeDir, "OFL.txt");
    await writeFile(path.join(target.outputRoot, licensePath), license);
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

  for (const [targetId, target] of Object.entries(targets)) {
    const manifest = manifests.get(targetId);
    const stylesheet = `${stylesheets.get(targetId).join("\n\n")}\n`;
    await writeFile(
      path.join(target.outputRoot, "fonts.css"),
      stylesheet,
      "utf8"
    );
    manifest.assets.push({
      path: "fonts.css",
      size: Buffer.byteLength(stylesheet),
      sha256: sha256(stylesheet),
    });
    manifest.assets.sort((left, right) => left.path.localeCompare(right.path));
    await writeFile(
      path.join(target.outputRoot, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    console.log(
      `Vendored ${manifest.assets.length} assets for ${targetId} from ${manifest.sources.length} pinned sources.`
    );
  }
};

if (verifyOnly) {
  await verifyAssets();
} else {
  await vendorAssets();
  await verifyAssets();
}

import fs from "node:fs";

const tag = process.argv[2];
const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag ?? "");

if (!match) {
  throw new Error(
    `Release tag must be a stable SemVer tag such as v0.1.0; received ${tag ?? "<missing>"}`
  );
}

const version = tag.slice(1);
const packages = [
  { name: "@chardesk/fonts", path: "packages/fonts" },
  { name: "@chardesk/protocol", path: "packages/protocol" },
];
const lockfile = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));

for (const descriptor of packages) {
  const manifest = JSON.parse(
    fs.readFileSync(`${descriptor.path}/package.json`, "utf8")
  );
  if (manifest.name !== descriptor.name) {
    throw new Error(
      `${descriptor.path}/package.json must be named ${descriptor.name}; received ${manifest.name}`
    );
  }
  if (manifest.version !== version) {
    throw new Error(
      `${descriptor.name} version ${manifest.version} does not match tag ${tag}`
    );
  }

  const locked = lockfile.packages?.[descriptor.path];
  if (locked?.version !== version) {
    throw new Error(
      `${descriptor.name} lockfile version ${locked?.version ?? "<missing>"} does not match tag ${tag}`
    );
  }
}

console.log(
  `Release ${tag} matches both workspace packages and package-lock.json.`
);

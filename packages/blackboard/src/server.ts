import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCharDeskDocumentEnvelope } from "@chardesk/document";
import {
  isBlackboardManifestPath,
  resolveReadableBoardPath,
  type WorkspaceBoardPath,
} from "./paths.js";
import { resolveBlackboardSource } from "./document.js";
import { compileBlackboardPackage } from "./package.js";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

const contentType = (path: string) => {
  switch (extname(path)) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".woff2": return "font/woff2";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
};

const send = (
  response: ServerResponse,
  status: number,
  body?: Uint8Array | string,
  headers: Record<string, string> = {}
) => {
  response.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  response.end(body);
};

const isInside = (root: string, candidate: string) => {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
};

const defaultAppRoot = fileURLToPath(new URL("../../../dist", import.meta.url));

type BlackboardServerOptions = {
  board: WorkspaceBoardPath;
  port?: number;
  appRoot?: string;
};

const readBoardProjection = async (readable: string) => {
  if (isBlackboardManifestPath(readable)) {
    const compiled = await compileBlackboardPackage(readable);
    return {
      source: serializeCharDeskDocumentEnvelope({
        mode: "freeform",
        title: compiled.title,
        body: compiled.source,
      }),
      sourceName: "blackboard.chardesk",
    };
  }
  const bytes = await readFile(readable);
  return {
    source: resolveBlackboardSource(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    ),
    sourceName: basename(readable),
  };
};

export const startBlackboardServer = async ({
  board,
  port = 7331,
  appRoot = defaultAppRoot,
}: BlackboardServerOptions) => {
  let staticRoot: string;
  try {
    staticRoot = await realpath(appRoot);
    await realpath(resolve(staticRoot, "index.html"));
  } catch {
    throw new Error(
      `CharDesk application build not found at ${appRoot}. Run the main application build first.`
    );
  }
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method !== "GET") {
        send(response, 405, undefined, { Allow: "GET" });
        return;
      }
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (pathname === "/board") {
        let readable: string;
        try {
          readable = await resolveReadableBoardPath(board);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            send(response, 404, undefined, { "Cache-Control": "no-store" });
            return;
          }
          send(response, 403);
          return;
        }
        let projection: Awaited<ReturnType<typeof readBoardProjection>>;
        try {
          projection = await readBoardProjection(readable);
        } catch (error) {
          send(response, 422, error instanceof Error ? error.message : "Invalid board source.", {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          });
          return;
        }
        const etag = `"${createHash("sha256")
          .update(projection.sourceName)
          .update("\0")
          .update(projection.source)
          .digest("hex")}"`;
        const headers = { "Cache-Control": "no-cache", ETag: etag };
        if (request.headers["if-none-match"] === etag) {
          send(response, 304, undefined, headers);
          return;
        }
        const body = new TextEncoder().encode(projection.source);
        send(response, 200, body, {
          ...headers,
          "Content-Length": String(body.byteLength),
          "Content-Type": "text/plain; charset=utf-8",
          "X-CharDesk-Source-Name": projection.sourceName,
        });
        return;
      }

      let decoded: string;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        send(response, 400);
        return;
      }
      if (decoded === "/") {
        send(response, 307, undefined, { Location: "/blackboard" });
        return;
      }
      const asset = resolve(
        staticRoot,
        decoded === "/blackboard" ? "index.html" : `.${decoded}`
      );
      if (!isInside(staticRoot, asset)) {
        send(response, 404);
        return;
      }
      try {
        const checked = await realpath(asset);
        if (!isInside(staticRoot, checked)) {
          send(response, 404);
          return;
        }
        const bytes = await readFile(checked);
        send(response, 200, bytes, {
          "Cache-Control": decoded === "/blackboard"
            ? "no-cache"
            : "public, max-age=31536000, immutable",
          "Content-Length": String(bytes.byteLength),
          "Content-Type": contentType(checked),
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          send(response, 404);
          return;
        }
        throw error;
      }
    })().catch(() => send(response, 500));
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Blackboard server did not bind TCP.");
  const url = `http://127.0.0.1:${address.port}`;
  return {
    server,
    url,
    close: () => new Promise<void>((resolveClose, reject) =>
      server.close((error) => error ? reject(error) : resolveClose())
    ),
  };
};

import { createSyncServer } from "./server.js";

const readPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const syncServer = createSyncServer({
  host: process.env.HOST ?? "0.0.0.0",
  port: readPositiveInteger(process.env.PORT, 1234),
  allowedOrigins,
  maxConnectionsPerRoom: readPositiveInteger(process.env.MAX_CONNECTIONS_PER_ROOM, 30),
  maxConnectionsPerIp: readPositiveInteger(process.env.MAX_CONNECTIONS_PER_IP, 20),
  maxConnectionAttemptsPerMinute: readPositiveInteger(
    process.env.MAX_CONNECTION_ATTEMPTS_PER_MINUTE,
    120
  ),
  trustProxy: process.env.TRUST_PROXY === "1",
});

const address = await syncServer.listen();
console.log(JSON.stringify({ event: "listening", ...address }));

const shutdown = async () => {
  await syncServer.close();
  process.exit(0);
};

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });

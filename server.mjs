import next from "next";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.PORT || 9080);
const hostname = process.env.LISTEN_HOST || "0.0.0.0";
const directory =
  process.env.DASHBOARD_DATA_DIR ||
  join(homedir(), ".local/share/server-dashboard");
const app = next({
  dev: process.env.NODE_ENV !== "production",
  hostname,
  port,
});
await app.prepare();
const handler = app.getRequestHandler();
const server = createServer(
  {
    key: readFileSync(join(directory, "key.pem")),
    cert: readFileSync(join(directory, "cert.pem")),
    minVersion: "TLSv1.2",
  },
  (req, res) => {
    handler(req, res).catch(() => {
      res.statusCode = 500;
      res.end("Internal server error");
    });
  },
);
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(port, hostname, () =>
  console.log(`Server dashboard: https://${hostname}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });

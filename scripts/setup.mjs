import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
const directory =
  process.env.DASHBOARD_DATA_DIR ||
  join(homedir(), ".local/share/server-dashboard");
mkdirSync(directory, { recursive: true, mode: 0o700 });
function create(name, text) {
  const path = join(directory, name);
  if (!existsSync(path)) writeFileSync(path, text, { mode: 0o600, flag: "wx" });
}
create("password", randomBytes(18).toString("base64url") + "\n");
create("servers.json", "[]\n");
if (
  !existsSync(join(directory, "cert.pem")) &&
  !existsSync(join(directory, "key.pem"))
) {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(directory, "key.pem"),
      "-out",
      join(directory, "cert.pem"),
      "-days",
      "3650",
      "-subj",
      "/CN=Server Dashboard",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
}
console.log(
  `Configurazione pronta: ${directory}\nPassword: ${join(directory, "password")}\nServer: ${join(directory, "servers.json")}`,
);

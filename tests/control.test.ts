import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  mkdir,
  unlink,
  rm,
} from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  control,
  findServer,
  inspect,
  readConfig,
  writeConfig,
} from "../src/lib/control";
import { GET, POST } from "../src/app/api/[...path]/route";
import { NextRequest } from "next/server";

test("systemd controls, config integrity and API authentication", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-test-"));
  const unit = `dashboard-test-${process.pid}.service`;
  const unitDir = join(homedir(), ".config/systemd/user");
  const config = join(directory, "server.properties");
  const previousDir = process.env.DASHBOARD_DATA_DIR;
  const sys = (...args: string[]) =>
    execFileSync("systemctl", ["--user", ...args], { stdio: "pipe" });
  await mkdir(unitDir, { recursive: true });
  await writeFile(
    join(unitDir, unit),
    "[Service]\nExecStart=/bin/sleep 300\n[Install]\nWantedBy=default.target\n",
    { flag: "wx" },
  );
  process.env.DASHBOARD_DATA_DIR = directory;
  await writeFile(
    join(directory, "servers.json"),
    JSON.stringify([{ id: "test", name: "Test", unit, configs: [config] }]),
  );
  await writeFile(join(directory, "password"), "test-password-only");
  await writeFile(config, "difficulty=normal\n");
  let cookie = "";
  function request(
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    return new NextRequest(`https://localhost/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Host: "localhost",
        Cookie: cookie,
        ...(body === undefined
          ? {}
          : {
              "Content-Type": "application/json",
              "X-Dashboard": "1",
              Origin: "https://localhost",
            }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function waitState(target: string) {
    for (let n = 0; n < 50; n++) {
      if ((await inspect(await findServer("test"))).state === target) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(`Did not reach ${target}`);
  }
  try {
    sys("daemon-reload");
    await t.test(
      "authentication, secure cookie and cross-origin protection",
      async () => {
        assert.equal((await GET(request("servers"))).status, 401);
        assert.equal(
          (await POST(request("login", { password: "wrong" }))).status,
          401,
        );
        assert.equal(
          (
            await POST(
              request(
                "login",
                { password: "test-password-only" },
                { Origin: "https://evil.example" },
              ),
            )
          ).status,
          403,
        );
        const login = await POST(
          request("login", { password: "test-password-only" }),
        );
        assert.equal(login.status, 200);
        assert.match(login.headers.get("set-cookie")!, /HttpOnly/);
        assert.match(login.headers.get("set-cookie")!, /Secure/);
        cookie = login.headers.get("set-cookie")!.split(";")[0];
        assert.equal((await GET(request("servers"))).status, 200);
        assert.equal(
          (
            await POST(
              request(
                "action",
                { id: "test", action: "start" },
                { "X-Dashboard": "" },
              ),
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "reject unknown services, commands and file indexes",
      async () => {
        await assert.rejects(control("unknown", "start"));
        await assert.rejects(control("test", "start; echo unsafe"));
        await assert.rejects(readConfig("test", -1));
        await assert.rejects(readConfig("test", 3));
      },
    );
    await t.test("enable and disable do not start the service", async () => {
      await control("test", "enable");
      assert.equal((await inspect(await findServer("test"))).enabled, true);
      assert.equal((await inspect(await findServer("test"))).state, "inactive");
      await control("test", "disable");
      assert.equal((await inspect(await findServer("test"))).enabled, false);
    });
    await t.test(
      "save creates an exact backup and rejects stale edits",
      async () => {
        const before = await readConfig("test", 0);
        await writeConfig("test", 0, "difficulty=hard\n", before.revision);
        assert.equal(await readFile(config, "utf8"), "difficulty=hard\n");
        const backupDir = join(directory, "backups/test");
        const backups = await readdir(backupDir);
        assert.equal(backups.length, 1);
        assert.equal(
          await readFile(join(backupDir, backups[0]), "utf8"),
          before.text,
        );
        await assert.rejects(
          writeConfig("test", 0, "old", before.revision),
          /cambiato/,
        );
        assert.equal(await readFile(config, "utf8"), "difficulty=hard\n");
      },
    );
    await t.test("start, restart, running write guard, and stop", async () => {
      assert.equal(
        (await POST(request("action", { id: "test", action: "start" }))).status,
        200,
      );
      await waitState("active");
      const live = await readConfig("test", 0);
      assert.equal(live.editable, false);
      await assert.rejects(
        writeConfig("test", 0, "bad", live.revision),
        /Spegni/,
      );
      await control("test", "restart");
      await waitState("active");
      await control("test", "stop");
      await waitState("inactive");
    });
    await t.test("logout invalidates the session on the server", async () => {
      assert.equal((await POST(request("logout", {}))).status, 200);
      assert.equal((await GET(request("servers"))).status, 401);
    });
  } finally {
    try {
      sys("disable", "--now", unit);
    } catch {}
    await unlink(join(unitDir, unit));
    sys("daemon-reload");
    if (previousDir === undefined) delete process.env.DASHBOARD_DATA_DIR;
    else process.env.DASHBOARD_DATA_DIR = previousDir;
    await rm(directory, { recursive: true });
  }
});

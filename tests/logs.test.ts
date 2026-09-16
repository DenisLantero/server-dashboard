import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { readLogs } from "../src/lib/logs";
import { ApiError } from "../src/lib/control";

test("logs use only configured units, bound output and report command failures", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-logs-"));
  const previous = {
    directory: process.env.DASHBOARD_DATA_DIR,
    path: process.env.PATH,
  };
  process.env.DASHBOARD_DATA_DIR = directory;
  process.env.PATH = `${directory}${delimiter}${previous.path}`;
  t.after(async () => {
    if (previous.directory === undefined) delete process.env.DASHBOARD_DATA_DIR;
    else process.env.DASHBOARD_DATA_DIR = previous.directory;
    if (previous.path === undefined) delete process.env.PATH;
    else process.env.PATH = previous.path;
    await rm(directory, { recursive: true, force: true });
  });
  const capture = join(directory, "args.json");
  const fake = (body: string) =>
    writeFile(join(directory, "journalctl"), `#!${process.execPath}\n${body}`, {
      mode: 0o700,
    });
  const save = (scope: string) =>
    writeFile(
      join(directory, "servers.json"),
      JSON.stringify([
        { id: "game", name: "Game", scope, unit: "game.service", configs: [] },
      ]),
    );
  await save("user");
  await fake(
    `require('node:fs').writeFileSync(${JSON.stringify(capture)}, JSON.stringify(process.argv.slice(2))); process.stdout.write('2026-09-16T20:00:00+0200 Game ready\\n');`,
  );
  assert.match((await readLogs("game")).text, /Game ready/);
  assert.deepEqual(JSON.parse(await readFile(capture, "utf8")), [
    "--user-unit=game.service",
    "--no-pager",
    "--quiet",
    "--lines=200",
    "--output=short-iso",
  ]);
  await save("system");
  await readLogs("game");
  assert.equal(
    JSON.parse(await readFile(capture, "utf8"))[0],
    "--unit=game.service",
  );
  await assert.rejects(
    readLogs("game; reboot"),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  );
  await fake("process.stdout.write('');");
  assert.deepEqual(await readLogs("game"), { text: "", limit: 200 });
  await fake("process.exit(1);");
  await assert.rejects(
    readLogs("game"),
    (error: unknown) => error instanceof ApiError && error.status === 503,
  );
  await fake("process.stdout.write('x'.repeat(2 * 1024 * 1024));");
  await assert.rejects(
    readLogs("game"),
    (error: unknown) => error instanceof ApiError && error.status === 503,
  );
});

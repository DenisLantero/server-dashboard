import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { definitions, exclusive, ApiError } from "../src/lib/control";

test("validate server definitions without coercing invalid fields", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-validation-"));
  const previous = process.env.DASHBOARD_DATA_DIR;
  process.env.DASHBOARD_DATA_DIR = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.DASHBOARD_DATA_DIR;
    else process.env.DASHBOARD_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  });
  const valid = {
    id: "minecraft",
    name: "Minecraft",
    unit: "minecraft.service",
    configs: ["/tmp/server.properties"],
  };
  const save = (value: unknown) =>
    writeFile(join(directory, "servers.json"), JSON.stringify(value));
  await save([valid]);
  assert.deepEqual(await definitions(), [
    { ...valid, scope: "user", description: "Server dedicato" },
  ]);
  for (const invalid of [
    {},
    [null],
    [valid, valid],
    ...[
      { id: 123 },
      { id: "../escape" },
      { name: " " },
      { description: {} },
      { unit: "-unsafe.service" },
      { unit: "game;reboot.service" },
      { configs: ["relative"] },
      { scope: "" },
      { scope: null },
    ].map((patch) => [{ ...valid, ...patch }]),
  ]) {
    await save(invalid);
    await assert.rejects(
      definitions(),
      (error: unknown) => error instanceof ApiError && error.status === 500,
    );
  }
});

test("mutation queue serializes operations and recovers after rejection", async () => {
  const events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = exclusive(async () => {
    events.push("first");
    await gate;
    throw new Error("failure");
  });
  const rejection = assert.rejects(first, /failure/);
  const second = exclusive(async () => {
    events.push("second");
    return 42;
  });
  await Promise.resolve();
  assert.deepEqual(events, ["first"]);
  release();
  await rejection;
  assert.equal(await second, 42);
  assert.deepEqual(events, ["first", "second"]);
});

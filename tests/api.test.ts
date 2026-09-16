import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/[...path]/route";

function request(
  path: string,
  body?: string,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`https://localhost/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Host: "localhost",
      Origin: "https://localhost",
      "Content-Type": "application/json",
      "X-Dashboard": "1",
      ...headers,
    },
    body,
  });
}

test("API validation, authentication and logout without systemd", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-api-"));
  const previous = process.env.DASHBOARD_DATA_DIR;
  process.env.DASHBOARD_DATA_DIR = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.DASHBOARD_DATA_DIR;
    else process.env.DASHBOARD_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(join(directory, "password"), "test-only-password");
  await writeFile(join(directory, "servers.json"), "[]");
  const loginBody = JSON.stringify({ password: "test-only-password" });
  assert.equal((await GET(request("servers"))).status, 401);
  for (const body of ["{", "null", "[]", "42", '"text"']) {
    assert.equal((await POST(request("login", body))).status, 400);
  }
  assert.equal((await POST(request("login", "x".repeat(1250001)))).status, 413);
  assert.equal(
    (
      await POST(
        request("login", loginBody, { Origin: "https://evil.example" }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request("login", loginBody, { "X-Dashboard": "" }))).status,
    403,
  );
  assert.equal(
    (await POST(request("login", loginBody, { "Content-Type": "text/plain" })))
      .status,
    403,
  );
  assert.equal(
    (await POST(request("login", '{"password":"wrong"}'))).status,
    401,
  );
  const login = await POST(
    request("login", loginBody, {
      "Content-Type": "application/json; charset=utf-8",
    }),
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=strict/i);
  const headers = { Cookie: cookie.split(";")[0] };
  const response = await GET(request("servers", undefined, headers));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), []);
  assert.equal(
    (await GET(request("config?id=test&file=-1", undefined, headers))).status,
    400,
  );
  assert.equal((await GET(request("missing", undefined, headers))).status, 404);
  assert.equal(
    (await POST(request("action", '{"id":"test","action":"reboot"}', headers)))
      .status,
    400,
  );
  assert.equal((await POST(request("logout", "{}", headers))).status, 200);
  assert.equal((await GET(request("servers", undefined, headers))).status, 401);
  for (let i = 0; i < 14; i++) {
    assert.equal(
      (await POST(request("login", '{"password":"wrong"}'))).status,
      401,
    );
  }
  assert.equal((await POST(request("login", loginBody))).status, 429);
});

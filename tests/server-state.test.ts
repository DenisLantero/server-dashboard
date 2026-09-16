import test from "node:test";
import assert from "node:assert/strict";
import { serverState, actionCompleted } from "../src/lib/server-state";
import type { ServerInfo } from "../src/lib/types";
const server: ServerInfo = {
  id: "test",
  name: "Test",
  description: "",
  scope: "user",
  unit: "test.service",
  configs: [],
  state: "inactive",
  subState: "dead",
  loaded: true,
  enabled: false,
  canEnable: true,
};
test("state labels never confuse the current state with the available action", () => {
  assert.equal(serverState(server).label, "Spento");
  assert.equal(serverState({ ...server, state: "active" }).label, "Acceso");
  assert.equal(serverState({ ...server, state: "failed" }).tone, "error");
  assert.equal(
    serverState({ ...server, loaded: false }).label,
    "Non disponibile",
  );
  assert.equal(
    serverState({ ...server, state: "active" }, true).label,
    "Stato non aggiornato",
  );
  assert.equal(serverState(server, false, "start").label, "Avvio in corso");
  assert.equal(
    serverState({ ...server, state: "mystery" }).label,
    "Stato sconosciuto",
  );
});
test("accepted commands remain pending until their state is confirmed", () => {
  assert.equal(actionCompleted(server, "start"), false);
  assert.equal(
    actionCompleted({ ...server, state: "activating" }, "start"),
    false,
  );
  assert.equal(actionCompleted({ ...server, state: "active" }, "start"), true);
  assert.equal(
    actionCompleted({ ...server, state: "deactivating" }, "stop"),
    false,
  );
  assert.equal(actionCompleted(server, "stop"), true);
  assert.equal(actionCompleted(server, "enable"), false);
  assert.equal(actionCompleted({ ...server, enabled: true }, "enable"), true);
});

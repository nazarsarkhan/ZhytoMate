import test from "node:test";
import assert from "node:assert/strict";
import { parseAlertStatus } from "../src/features/alert/alert.client.js";

test("parses the Zhytomyr state from ubilling aerial alerts", () => {
  assert.equal(parseAlertStatus({ states: { "Житомирська область": { alertnow: true } } }), "active");
  assert.equal(parseAlertStatus({ states: { "Житомирська область": { alertnow: false } } }), "none");
});

test("rejects an unknown compact status", () => {
  assert.equal(parseAlertStatus({ states: {} }), null);
  assert.equal(parseAlertStatus({ states: { "Житомирська область": {} } }), null);
});

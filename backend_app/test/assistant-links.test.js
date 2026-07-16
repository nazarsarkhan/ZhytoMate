import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAppLinks } from "../src/shared/mlClient.js";

test("sanitizes app links to known user-facing routes", () => {
  const links = sanitizeAppLinks([
    { capability: "transport", label: "Транспорт", route: "/services/transport", reason: "routes" },
    { capability: "admin", label: "Admin", route: "/admin/users", reason: "no" },
    { capability: "external", label: "External", route: "https://example.com", reason: "no" },
    { capability: "bad", label: "Bad", route: "/unknown", reason: "no" },
    { capability: "duplicate", label: "Again", route: "/services/transport", reason: "again" },
    null,
  ]);

  assert.deepEqual(links, [
    { capability: "transport", label: "Транспорт", route: "/services/transport", reason: "routes" },
  ]);
});

test("caps app links at three unique routes", () => {
  const links = sanitizeAppLinks([
    { capability: "a", label: "A", route: "/services", reason: "a" },
    { capability: "b", label: "B", route: "/services/contacts", reason: "b" },
    { capability: "c", label: "C", route: "/services/polls", reason: "c" },
    { capability: "d", label: "D", route: "/places", reason: "d" },
  ]);

  assert.equal(links.length, 3);
});

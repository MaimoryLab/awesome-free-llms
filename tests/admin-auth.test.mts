import assert from "node:assert/strict";
import test from "node:test";
import { hasAdminCredentials } from "../lib/admin-auth.ts";

test("admin basic auth only accepts configured credentials", () => {
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "secret";
  const valid = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
  const wrong = `Basic ${Buffer.from("admin:wrong").toString("base64")}`;
  assert.equal(hasAdminCredentials(valid), true);
  assert.equal(hasAdminCredentials(wrong), false);
  assert.equal(hasAdminCredentials(null), false);
});

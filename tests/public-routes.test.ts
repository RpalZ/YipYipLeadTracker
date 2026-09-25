import assert from "node:assert/strict";
import test from "node:test";

import { isSessionlessPublicRoute } from "../lib/supabase/public-routes";

test("login and explicit demo routes bypass Supabase session refresh", () => {
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/login")), true);
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/?demo=empty")), true);
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/?demo=sample")), true);
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/sources?demo=empty")), true);
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/api/internal/automation/tick")), true);
});

test("authenticated and unspecified routes retain Supabase session refresh", () => {
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/")), false);
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/sources")), false);
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/sources?demo=sample")), false);
  assert.equal(isSessionlessPublicRoute(new URL("http://localhost/api/health?demo=empty")), false);
});

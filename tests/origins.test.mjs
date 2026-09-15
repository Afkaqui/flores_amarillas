import { test } from "node:test";
import assert from "node:assert/strict";
import { createOriginGuard } from "../server/origins.js";

test("migration accepts exact old/new origins but rejects foreign and cross-site requests", () => {
  const origins = ["https://floresparati.site", "https://amarillas.pascare.tech"];
  const guard = createOriginGuard(origins);
  const request = (origin, site = "same-origin") => {
    let result;
    guard(
      { get: (name) => ({ origin, "sec-fetch-site": site })[name] },
      { status: (status) => ({ json: () => { result = status; } }) },
      () => { result = 200; },
    );
    return result;
  };
  for (const origin of origins) assert.equal(request(origin), 200);
  for (const origin of ["https://evil.example", "https://floresparati.site.evil.example", "http://floresparati.site", "https://floresparati.site:444", "null"]) {
    assert.equal(request(origin), 403);
  }
  assert.equal(request(origins[0], "cross-site"), 403);
  assert.equal(request(origins[1], "cross-site"), 403);
  assert.equal(request(undefined, "cross-site"), 403);
  assert.equal(request(undefined, "none"), 200);
});

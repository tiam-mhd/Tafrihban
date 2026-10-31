import test from "node:test";
import assert from "node:assert/strict";
import { platformAuthPlugins } from "../src/lib/platform-auth-plugins";

test("platform Better Auth applies the Next.js cookie bridge after other plugins", () => {
  assert.equal(platformAuthPlugins.at(-1)?.id, "next-cookies");
});

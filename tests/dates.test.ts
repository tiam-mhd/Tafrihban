import test from "node:test";
import assert from "node:assert/strict";
import { formatBranchTime, localDateTimeToUtc } from "../src/lib/dates";

test("branch local date-time is converted to a UTC instant", () => {
  assert.equal(localDateTimeToUtc("2026-01-01T12:00", "Asia/Tehran").toISOString(), "2026-01-01T08:30:00.000Z");
});

test("nonexistent daylight-saving local time is rejected", () => {
  assert.throws(() => localDateTimeToUtc("2026-03-08T02:30", "America/New_York"));
});

test("branch dates render with Jalali calendar and branch timezone", () => {
  const value = formatBranchTime("2026-01-01T08:30:00.000Z", "Asia/Tehran");
  assert.match(value, /۱۴۰۴/);
});

import { describe, expect, it } from "vitest";
import { isUniqueConstraintError, normalizeCounts, sumCounts } from "./poll-utils";

describe("normalizeCounts", () => {
  it("fills missing options with zeros", () => {
    const result = normalizeCounts([{ id: "a" }, { id: "b" }], { a: "2" });

    expect(result).toEqual({ a: 2, b: 0 });
  });
});

describe("sumCounts", () => {
  it("sums values", () => {
    expect(sumCounts({ a: 2, b: 3 })).toBe(5);
  });
});

describe("isUniqueConstraintError", () => {
  it("detects Prisma unique constraint errors", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isUniqueConstraintError({ code: "OTHER" })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});

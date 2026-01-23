import { describe, expect, it } from "vitest";
import { extractPollId } from "@/lib/poll-links";

describe("extractPollId", () => {
  it("returns null for empty input", () => {
    expect(extractPollId(" ")).toBeNull();
  });

  it("returns raw id", () => {
    expect(extractPollId("abc123")).toBe("abc123");
  });

  it("parses full poll URL", () => {
    expect(extractPollId("https://example.com/poll/xyz")).toBe("xyz");
  });

  it("parses poll path", () => {
    expect(extractPollId("/poll/xyz")).toBe("xyz");
  });

  it("parses www URL", () => {
    expect(extractPollId("www.example.com/poll/xyz")).toBe("xyz");
  });

  it("returns null for invalid URL input", () => {
    expect(extractPollId("https://example.com/poll")).toBeNull();
  });
});

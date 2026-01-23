import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockCookies = vi.hoisted(() => vi.fn());
const mockGetSessionUserByToken = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/auth", () => ({
  getSessionCookieName: () => "session",
  getSessionUserByToken: mockGetSessionUserByToken,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    poll: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: null,
}));

describe("POST /api/polls", () => {
  it("returns 400 for invalid JSON", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "token" }),
    });
    mockGetSessionUserByToken.mockResolvedValue({ id: "user-1" });

    const response = await POST(
      new Request("http://localhost/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid JSON payload.",
    });
  });
});

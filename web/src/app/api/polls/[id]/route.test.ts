import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mockCookies = vi.hoisted(() => vi.fn());
const mockGetSessionUserByToken = vi.hoisted(() => vi.fn());
const mockPollFindUnique = vi.hoisted(() => vi.fn());
const mockPollUpdate = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());

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
      findUnique: mockPollFindUnique,
      update: mockPollUpdate,
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    set: mockRedisSet,
  },
}));

describe("PATCH /api/polls/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not signed in", async () => {
    mockCookies.mockResolvedValue({
      get: () => undefined,
    });
    mockGetSessionUserByToken.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: true }),
      }),
      { params: { id: "poll-1" } },
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "token" }),
    });
    mockGetSessionUserByToken.mockResolvedValue({ id: "user-1" });

    const response = await PATCH(
      new Request("http://localhost/api/polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not-json}",
      }),
      { params: { id: "poll-1" } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid JSON payload.",
    });
  });

  it("returns 403 when user does not own the poll", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "token" }),
    });
    mockGetSessionUserByToken.mockResolvedValue({ id: "user-1" });
    mockPollFindUnique.mockResolvedValue({
      id: "poll-1",
      creatorId: "user-2",
    });

    const response = await PATCH(
      new Request("http://localhost/api/polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: false }),
      }),
      { params: { id: "poll-1" } },
    );

    expect(response.status).toBe(403);
  });

  it("updates poll status and syncs redis", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "token" }),
    });
    mockGetSessionUserByToken.mockResolvedValue({ id: "user-1" });
    mockPollFindUnique.mockResolvedValue({
      id: "poll-1",
      creatorId: "user-1",
    });
    mockPollUpdate.mockResolvedValue({ id: "poll-1", isOpen: false });

    const response = await PATCH(
      new Request("http://localhost/api/polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: false }),
      }),
      { params: { id: "poll-1" } },
    );

    expect(response.status).toBe(200);
    expect(mockPollUpdate).toHaveBeenCalledWith({
      where: { id: "poll-1" },
      data: { isOpen: false },
    });
    expect(mockRedisSet).toHaveBeenCalledWith("poll:poll-1:open", "0");
  });
});

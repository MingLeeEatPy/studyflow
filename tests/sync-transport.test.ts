import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  attempts: 0,
  ensureValidSession: vi.fn(),
  refreshSession: vi.fn(),
}));

const session = {
  access_token: "token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 2_000_000_000,
  refresh_token: "refresh",
  user: { id: "user-1" },
};

vi.mock("../src/features/authAdapter", () => ({
  authAdapter: {
    getUserId: () => "user-1",
    ensureValidSession: state.ensureValidSession,
    refreshSession: state.refreshSession,
  },
}));

vi.mock("../src/features/supabaseClient", () => ({
  getSupabaseClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gt", "order"]) chain[method] = vi.fn(() => chain);
      chain.limit = vi.fn(async () => {
        state.attempts += 1;
        if (state.attempts === 1) return { data: null, error: { code: "401", message: "JWT expired" } };
        return {
          data: [{ entity_type: "task", entity_id: "task-1", payload: {}, updated_at: "2026-08-30T08:00:00.000Z", created_at: "2026-08-30T08:00:00.000Z", deleted_at: null }],
          error: null,
        };
      });
      return chain;
    },
  }),
}));

import { isAuthenticationError, pullSyncChanges } from "../src/features/syncTransport";

describe("同步传输会话恢复", () => {
  it("遇到 401 时刷新会话并只重试一次", async () => {
    state.attempts = 0;
    state.ensureValidSession.mockReset().mockResolvedValue(session);
    state.refreshSession.mockReset().mockResolvedValue(session);

    const result = await pullSyncChanges("1970-01-01T00:00:00.000Z");

    expect(result.changes).toHaveLength(1);
    expect(state.refreshSession).toHaveBeenCalledTimes(1);
    expect(state.attempts).toBe(2);
  });

  it("识别 Supabase 的常见认证错误", () => {
    expect(isAuthenticationError({ code: "PGRST301", message: "JWT expired" })).toBe(true);
    expect(isAuthenticationError({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});

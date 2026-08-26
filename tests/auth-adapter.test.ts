import { afterEach, describe, expect, it, vi } from "vitest";
import { authAdapter } from "../src/features/authAdapter";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Supabase 认证适配层", () => {
  it("读取本地配置但未登录时保持未登录状态", async () => {
    expect(authAdapter.isConfigured()).toBe(true);
    await expect(authAdapter.getUser()).resolves.toBeNull();
  });

  it("未登录时没有本地会话令牌", () => {
    expect(authAdapter.getAccessToken()).toBeNull();
    expect(authAdapter.getUserId()).toBeNull();
  });
});

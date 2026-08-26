import { getSupabaseConfig, supabaseHeaders } from "./supabaseClient";

export type AuthUser = { id: string; email: string | null };
type AuthSession = { access_token: string; user: AuthUser };
const SESSION_KEY = "studyflow.supabase.session";

function readSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as AuthSession : null;
  } catch { return null; }
}

function writeSession(session: AuthSession | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export const authAdapter = {
  isConfigured: () => getSupabaseConfig() !== null,
  getUser: async (): Promise<AuthUser | null> => readSession()?.user ?? null,
  getAccessToken: (): string | null => readSession()?.access_token ?? null,
  getUserId: (): string | null => readSession()?.user.id ?? null,
  signInWithMagicLink: async (email: string): Promise<void> => {
    const config = getSupabaseConfig();
    if (!config) throw new Error("Supabase 尚未配置");
    const response = await fetch(`${config.url}/auth/v1/otp`, {
      method: "POST", headers: supabaseHeaders(config),
      body: JSON.stringify({ email, create_user: true, gotrue_meta_security: {}, options: { emailRedirectTo: window.location.origin } }),
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error("登录邮件发送过于频繁。请等待一段时间后再试；内置邮件服务适合测试，正式多人内测请配置自定义 SMTP。");
      throw new Error(`登录链接发送失败（${response.status}）`);
    }
  },
  handleCallback: async (): Promise<AuthUser | null> => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    if (!accessToken) return readSession()?.user ?? null;
    const config = getSupabaseConfig();
    if (!config) return null;
    const response = await fetch(`${config.url}/auth/v1/user`, { headers: supabaseHeaders(config, accessToken) });
    if (!response.ok) throw new Error("登录链接已失效，请重新获取");
    const user = await response.json() as AuthUser;
    writeSession({ access_token: accessToken, user });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return user;
  },
  signOut: async (): Promise<void> => {
    const session = readSession();
    const config = getSupabaseConfig();
    if (session && config) await fetch(`${config.url}/auth/v1/logout`, { method: "POST", headers: supabaseHeaders(config, session.access_token) });
    writeSession(null);
  },
};

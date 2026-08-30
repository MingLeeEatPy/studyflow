import type { AuthChangeEvent, AuthError, Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";

export type AuthUser = { id: string; email: string | null; provider?: string | null };
export type AuthResult = { user: AuthUser | null; needsEmailConfirmation: boolean };

function mapUser(user: User | null): AuthUser | null {
  if (!user) return null;
  const provider = user.app_metadata?.provider ?? user.identities?.[0]?.provider ?? null;
  return { id: user.id, email: user.email ?? null, provider };
}

function friendlyError(error: AuthError): Error {
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) return new Error("邮箱或密码不正确");
  if (message.includes("user already registered")) return new Error("该邮箱已经注册，请直接登录");
  if (message.includes("password should be at least")) return new Error("密码至少需要 6 位");
  if (message.includes("rate limit") || message.includes("too many")) return new Error("请求过于频繁，请稍后再试");
  if (message.includes("redirect")) return new Error("登录回调地址未配置，请检查 Supabase 的 Site URL 和 Redirect URLs");
  return new Error(error.message);
}

let cachedSession: Session | null = null;
let sessionReady: Promise<void> | null = null;

function clientOrThrow() {
  const client = getSupabaseClient();
  if (!client) throw new Error("尚未配置云同步服务");
  return client;
}

function ensureSessionCache() {
  if (sessionReady) return sessionReady;
  const client = getSupabaseClient();
  sessionReady = client ? client.auth.getSession().then(({ data }) => { cachedSession = data.session; }) : Promise.resolve();
  if (client) client.auth.onAuthStateChange((_event, session) => { cachedSession = session; });
  return sessionReady;
}

export const authAdapter = {
  isConfigured: () => getSupabaseClient() !== null,
  getUser: async (): Promise<AuthUser | null> => { await ensureSessionCache(); return mapUser(cachedSession?.user ?? null); },
  getSession: async (): Promise<Session | null> => { await ensureSessionCache(); return cachedSession; },
  getAccessToken: (): string | null => cachedSession?.access_token ?? null,
  getUserId: (): string | null => cachedSession?.user.id ?? null,
  signUp: async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await clientOrThrow().auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      cachedSession = data.session;
      return { user: mapUser(data.user), needsEmailConfirmation: !data.session && Boolean(data.user) };
    } catch (error) { throw friendlyError(error as AuthError); }
  },
  signIn: async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await clientOrThrow().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      cachedSession = data.session;
      return { user: mapUser(data.user), needsEmailConfirmation: false };
    } catch (error) { throw friendlyError(error as AuthError); }
  },
  signInWithMagicLink: async (email: string): Promise<void> => {
    try {
      const { error } = await clientOrThrow().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
    } catch (error) { throw friendlyError(error as AuthError); }
  },
  signInWithGoogle: async (): Promise<void> => {
    try {
      const { error } = await clientOrThrow().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (error) { throw friendlyError(error as AuthError); }
  },
  sendPasswordReset: async (email: string): Promise<void> => {
    try {
      const { error } = await clientOrThrow().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/#reset-password` });
      if (error) throw error;
    } catch (error) { throw friendlyError(error as AuthError); }
  },
  updatePassword: async (password: string): Promise<void> => {
    try {
      const { error } = await clientOrThrow().auth.updateUser({ password });
      if (error) throw error;
    } catch (error) { throw friendlyError(error as AuthError); }
  },
  handleCallback: async (): Promise<AuthUser | null> => {
    await ensureSessionCache();
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw friendlyError(error);
    cachedSession = data.session;
    return mapUser(data.session?.user ?? null);
  },
  onAuthStateChange: (listener: (user: AuthUser | null, event: AuthChangeEvent) => void): (() => void) => {
    const client = getSupabaseClient();
    if (!client) return () => undefined;
    const { data } = client.auth.onAuthStateChange((event, session) => { cachedSession = session; listener(mapUser(session?.user ?? null), event); });
    return () => data.subscription.unsubscribe();
  },
  signOut: async (): Promise<void> => {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw friendlyError(error);
    }
    cachedSession = null;
  },
};

void ensureSessionCache();

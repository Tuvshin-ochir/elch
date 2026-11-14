/**
 * Meta Graph API client.
 *
 * Two ways a channel can be connected (ConnectedPage.kind):
 *  - FACEBOOK_LOGIN  → graph.facebook.com with a Page access token. Covers Messenger and the
 *                      Instagram account linked to that page.
 *  - INSTAGRAM_LOGIN → graph.instagram.com with an Instagram user token. Instagram only,
 *                      no Facebook page required.
 */
import crypto from "node:crypto";
import { config } from "../../config.ts";
import type { ConnectionKind } from "../../generated/prisma/enums.ts";

export type Api = "fb" | "ig";
export const apiFor = (kind: ConnectionKind): Api => (kind === "INSTAGRAM_LOGIN" ? "ig" : "fb");

const base = (api: Api) =>
  api === "ig" ? `https://graph.instagram.com/${config.meta.graphVersion}` : `https://graph.facebook.com/${config.meta.graphVersion}`;

export class GraphError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public subcode?: number,
  ) {
    super(message);
  }
}

export async function graph<T>(
  path: string,
  opts: { api?: Api; method?: "GET" | "POST" | "DELETE"; token?: string; query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const api = opts.api ?? "fb";
  const url = new URL(`${base(api)}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  if (opts.token) {
    url.searchParams.set("access_token", opts.token);
    if (api === "fb" && config.meta.appSecret) {
      url.searchParams.set("appsecret_proof", crypto.createHmac("sha256", config.meta.appSecret).update(opts.token).digest("hex"));
    }
  }
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message: string; code?: number; error_subcode?: number } | string;
    error_message?: string;
  } & T;
  if (!res.ok || data.error) {
    const e = data.error;
    const msg = typeof e === "string" ? (data.error_message ?? e) : (e?.message ?? `Graph ${res.status}`);
    throw new GraphError(msg, res.status, typeof e === "object" ? e?.code : undefined, typeof e === "object" ? e?.error_subcode : undefined);
  }
  return data;
}

// ───────── Facebook Login (pages + linked Instagram) ─────────

/** Every Meta OAuth flow lands on the API (Instagram requires https; one URL per provider keeps Meta setup simple). */
export const fbRedirectUri = () => `${config.publicApiUrl}/api/oauth/facebook/callback`;
export const igRedirectUri = () => `${config.publicApiUrl}/api/oauth/instagram/callback`;

export const OAUTH_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "business_management",
];

export function oauthDialogUrl(redirectUri: string, state: string, extraScopes: string[] = []): string {
  const u = new URL(`https://www.facebook.com/${config.meta.graphVersion}/dialog/oauth`);
  u.searchParams.set("client_id", config.meta.appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  if (config.meta.loginConfigId) {
    // Facebook Login for Business: permissions come from the configuration
    u.searchParams.set("config_id", config.meta.loginConfigId);
    u.searchParams.set("override_default_response_type", "true");
  } else {
    u.searchParams.set("scope", [...OAUTH_SCOPES, ...extraScopes].join(","));
  }
  u.searchParams.set("response_type", "code");
  return u.toString();
}

export async function exchangeCode(code: string, redirectUri: string) {
  const short = await graph<{ access_token: string }>("oauth/access_token", {
    query: {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: redirectUri,
      code,
    },
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    query: {
      grant_type: "fb_exchange_token",
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: short.access_token,
    },
  });
  const me = await graph<{ id: string; name: string; email?: string; picture?: { data?: { url?: string } } }>("me", {
    token: long.access_token,
    query: { fields: "id,name,email,picture{url}" },
  });
  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
    userId: me.id,
    userName: me.name,
    email: me.email?.toLowerCase() ?? null,
    picture: me.picture?.data?.url ?? null,
  };
}

export interface FbPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string };
}

export async function listPages(userToken: string): Promise<FbPage[]> {
  const out: FbPage[] = [];
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await graph<{ data: FbPage[]; paging?: { cursors?: { after?: string }; next?: string } }>("me/accounts", {
      token: userToken,
      query: {
        fields: "id,name,access_token,category,picture{url},instagram_business_account{id,username}",
        limit: "100",
        ...(after ? { after } : {}),
      },
    });
    out.push(...r.data);
    if (!r.paging?.next) break;
    after = r.paging.cursors?.after;
  }
  return out;
}

export async function subscribePage(pageId: string, pageToken: string) {
  await graph(`${pageId}/subscribed_apps`, {
    method: "POST",
    token: pageToken,
    query: { subscribed_fields: "messages,messaging_postbacks,message_echoes,messaging_referrals,feed" },
  });
}

export async function unsubscribePage(pageId: string, pageToken: string) {
  await graph(`${pageId}/subscribed_apps`, { method: "DELETE", token: pageToken }).catch(() => undefined);
}

// ───────── Instagram Login (Instagram without a Facebook page) ─────────

export const IG_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages", "instagram_business_manage_comments"];

export function igOauthDialogUrl(redirectUri: string, state: string): string {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", config.instagram.appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", state);
  u.searchParams.set("enable_fb_login", "0");
  return u.toString();
}

/** code → long-lived (60 day) Instagram user token + the professional account id used in webhooks */
export async function igExchangeCode(code: string, redirectUri: string) {
  const form = new URLSearchParams({
    client_id: config.instagram.appId,
    client_secret: config.instagram.appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code: code.replace(/#_$/, ""),
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const raw = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    data?: Array<{ access_token: string }>;
    error_message?: string;
    error?: { message?: string };
  };
  const shortToken = raw.access_token ?? raw.data?.[0]?.access_token;
  if (!res.ok || !shortToken) throw new GraphError(raw.error_message ?? raw.error?.message ?? "Instagram token exchange failed", res.status);

  const long = await graph<{ access_token: string; expires_in: number }>("access_token", {
    api: "ig",
    query: { grant_type: "ig_exchange_token", client_secret: config.instagram.appSecret, access_token: shortToken },
  });
  const me = await graph<{ user_id: string; username: string; name?: string; profile_picture_url?: string }>("me", {
    api: "ig",
    token: long.access_token,
    query: { fields: "user_id,username,name,profile_picture_url" },
  });
  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + long.expires_in * 1000),
    igAccountId: String(me.user_id),
    username: me.username,
    name: me.name || me.username,
    picture: me.profile_picture_url,
  };
}

export async function igRefreshToken(token: string) {
  return graph<{ access_token: string; expires_in: number }>("refresh_access_token", {
    api: "ig",
    query: { grant_type: "ig_refresh_token", access_token: token },
  });
}

export async function igSubscribe(token: string) {
  await graph("me/subscribed_apps", { api: "ig", method: "POST", token, query: { subscribed_fields: "messages,comments" } });
}

export async function igUnsubscribe(token: string) {
  await graph("me/subscribed_apps", { api: "ig", method: "DELETE", token }).catch(() => undefined);
}

// ───────── Messaging (works for both APIs) ─────────

export type MessagingType = "RESPONSE" | "UPDATE" | "MESSAGE_TAG";

export async function sendText(args: {
  api: Api;
  token: string;
  recipientId: string;
  text: string;
  messagingType?: MessagingType;
  tag?: string;
}): Promise<{ message_id?: string }> {
  return graph("me/messages", {
    api: args.api,
    method: "POST",
    token: args.token,
    body: {
      recipient: { id: args.recipientId },
      ...(args.api === "fb" ? { messaging_type: args.tag ? "MESSAGE_TAG" : (args.messagingType ?? "RESPONSE") } : {}),
      ...(args.tag ? { tag: args.tag } : {}),
      message: { text: args.text },
    },
  });
}

export async function sendSenderAction(api: Api, token: string, recipientId: string, action: "typing_on" | "typing_off" | "mark_seen") {
  await graph("me/messages", {
    api,
    method: "POST",
    token,
    body: { recipient: { id: recipientId }, sender_action: action },
  }).catch(() => undefined);
}

/** Private reply to a comment (opens a DM thread with the commenter) */
export async function sendPrivateReply(api: Api, token: string, commentId: string, text: string) {
  return graph<{ recipient_id?: string; message_id?: string }>("me/messages", {
    api,
    method: "POST",
    token,
    body: { recipient: { comment_id: commentId }, message: { text } },
  });
}

export async function replyToFbComment(pageToken: string, commentId: string, text: string) {
  return graph(`${commentId}/comments`, { method: "POST", token: pageToken, body: { message: text } });
}

export async function replyToIgComment(api: Api, token: string, commentId: string, text: string) {
  return graph(`${commentId}/replies`, { api, method: "POST", token, body: { message: text } });
}

export async function getMessengerProfile(pageToken: string, psid: string) {
  return graph<{ first_name?: string; last_name?: string; name?: string; profile_pic?: string }>(psid, {
    token: pageToken,
    query: { fields: "first_name,last_name,profile_pic" },
  }).catch(() => null);
}

export async function getInstagramProfile(api: Api, token: string, igsid: string) {
  return graph<{ name?: string; username?: string; profile_pic?: string }>(igsid, {
    api,
    token,
    query: { fields: "name,username,profile_pic" },
  }).catch(() => null);
}

// ───────── Page / account data (for knowledge import) ─────────

export async function getPageInfo(pageId: string, pageToken: string) {
  return graph<Record<string, unknown>>(pageId, {
    token: pageToken,
    query: {
      fields:
        "name,about,description,category,phone,emails,website,single_line_address,location,hours,general_info,company_overview,mission,products,price_range",
    },
  });
}

export async function getPagePosts(pageId: string, pageToken: string, limit = 50) {
  return graph<{ data: Array<{ id: string; message?: string; created_time: string }> }>(`${pageId}/posts`, {
    token: pageToken,
    query: { fields: "id,message,created_time", limit: String(limit) },
  });
}

/** igId = the IG account id (FB login) or "me" (Instagram Login) */
export async function getIgMedia(api: Api, igId: string, token: string, limit = 50) {
  return graph<{ data: Array<{ id: string; caption?: string; timestamp: string; permalink?: string }> }>(`${igId}/media`, {
    api,
    token,
    query: { fields: "id,caption,timestamp,permalink", limit: String(limit) },
  });
}

export async function getIgProfile(api: Api, igId: string, token: string) {
  return graph<{ username?: string; name?: string; biography?: string; website?: string }>(igId, {
    api,
    token,
    query: { fields: "username,name,biography,website" },
  });
}

// ───────── Webhook signature ─────────

/** Facebook-Login webhooks are signed with the Meta app secret, Instagram-Login ones with the Instagram app secret. */
export function verifySignature(rawBody: Buffer, header: string | undefined): boolean {
  const secrets = [config.meta.appSecret, config.instagram.appSecret].filter(Boolean);
  if (!secrets.length) return !config.isProd; // allow unsigned in local dev only
  if (!header?.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7));
  return secrets.some((secret) => {
    const expected = Buffer.from(crypto.createHmac("sha256", secret).update(rawBody).digest("hex"));
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

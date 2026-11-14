import "dotenv/config";

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4100),
  isProd: process.env.NODE_ENV === "production",
  publicApiUrl: req("PUBLIC_API_URL", "http://localhost:4100").replace(/\/$/, ""),
  appUrl: req("APP_URL", "http://localhost:3100").replace(/\/$/, ""),
  databaseUrl: req("DATABASE_URL"),
  jwtSecret: req("JWT_SECRET"),
  encryptionKey: req("ENCRYPTION_KEY"),

  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    // AI_* (not CLAUDE_*) so Claude Code's own env vars never leak into the bot config
    model: process.env.AI_MODEL || "claude-opus-5-5",
    effort: (["low", "medium", "high", "xhigh", "max"].includes(process.env.AI_EFFORT ?? "")
      ? process.env.AI_EFFORT
      : "low") as "low" | "medium" | "high" | "xhigh" | "max",
  },

  meta: {
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    verifyToken: process.env.META_VERIFY_TOKEN ?? "",
    /** Facebook Login for Business configuration id (optional — falls back to `scope`) */
    loginConfigId: process.env.META_LOGIN_CONFIG_ID ?? "",
    graphVersion: process.env.META_GRAPH_VERSION || "v23.0",
    get enabled() {
      return Boolean(this.appId && this.appSecret);
    },
  },

  /** Instagram API with Instagram Login (connect IG without a Facebook page).
   *  Meta App Dashboard → Instagram → API setup with Instagram login → Instagram app ID / secret */
  instagram: {
    appId: process.env.IG_APP_ID ?? "",
    appSecret: process.env.IG_APP_SECRET ?? "",
    get enabled() {
      return Boolean(this.appId && this.appSecret);
    },
  },

  qpay: {
    baseUrl: (process.env.QPAY_BASE_URL || "https://merchant-sandbox.qpay.mn").replace(/\/$/, ""),
    clientId: process.env.QPAY_CLIENT_ID ?? "",
    clientSecret: process.env.QPAY_CLIENT_SECRET ?? "",
    invoiceCode: process.env.QPAY_INVOICE_CODE ?? "",
    get mock() {
      return !this.clientId;
    },
  },

  cardProvider: process.env.CARD_PROVIDER || "mock",

  /** Sandbox payments (fake QPay QR, mock bank page). Always on in dev; in production only with ALLOW_MOCK_PAYMENTS=true. */
  get mockPaymentsAllowed() {
    return !this.isProd || process.env.ALLOW_MOCK_PAYMENTS === "true";
  },
  get qpayAvailable() {
    return !this.qpay.mock || this.mockPaymentsAllowed;
  },
  get cardAvailable() {
    return this.cardProvider !== "mock" || this.mockPaymentsAllowed;
  },
  /** Shown to customers when no online payment is available (bank account, phone…) — an admin then activates the plan in /admin */
  manualPaymentNote: process.env.MANUAL_PAYMENT_NOTE ?? "",
};

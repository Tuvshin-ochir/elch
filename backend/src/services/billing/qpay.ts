/**
 * QPay merchant API v2 client.
 * Docs: https://developer.qpay.mn  — sandbox: https://merchant-sandbox.qpay.mn
 * When QPAY_CLIENT_ID is empty the service runs in MOCK mode (QR is generated locally
 * and the dashboard shows a "simulate payment" button).
 */
import QRCode from "qrcode";
import { config } from "../../config.ts";

let cached: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${config.qpay.clientId}:${config.qpay.clientSecret}`).toString("base64");
  const res = await fetch(`${config.qpay.baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`QPay auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  // expires_in is a unix timestamp (seconds) in QPay v2
  const exp = data.expires_in > 1e9 ? data.expires_in * 1000 : Date.now() + data.expires_in * 1000;
  cached = { token: data.access_token, expiresAt: exp };
  return data.access_token;
}

export interface QPayInvoice {
  invoiceId: string;
  qrText: string;
  qrImage: string; // base64 PNG (no data: prefix)
  deeplinks: Array<{ name: string; description?: string; logo?: string; link: string }>;
}

export async function createInvoice(args: {
  paymentId: string;
  amount: number;
  description: string;
  receiverCode: string;
}): Promise<QPayInvoice> {
  const callbackUrl = `${config.publicApiUrl}/api/billing/qpay/callback?paymentId=${encodeURIComponent(args.paymentId)}`;

  if (config.qpay.mock) {
    const qrText = `MOCK-QPAY|${args.paymentId}|${args.amount}`;
    const dataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 320 });
    return {
      invoiceId: `mock_${args.paymentId}`,
      qrText,
      qrImage: dataUrl.replace(/^data:image\/png;base64,/, ""),
      deeplinks: [],
    };
  }

  const token = await getToken();
  const res = await fetch(`${config.qpay.baseUrl}/v2/invoice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      invoice_code: config.qpay.invoiceCode,
      sender_invoice_no: args.paymentId,
      invoice_receiver_code: args.receiverCode,
      invoice_description: args.description,
      amount: args.amount,
      callback_url: callbackUrl,
    }),
  });
  if (!res.ok) throw new Error(`QPay invoice failed: ${res.status} ${await res.text()}`);
  const d = (await res.json()) as {
    invoice_id: string;
    qr_text: string;
    qr_image: string;
    urls?: Array<{ name: string; description?: string; logo?: string; link: string }>;
  };
  return { invoiceId: d.invoice_id, qrText: d.qr_text, qrImage: d.qr_image, deeplinks: d.urls ?? [] };
}

/** Returns true when the invoice has a PAID payment. Never trust the callback alone. */
export async function isInvoicePaid(invoiceId: string): Promise<boolean> {
  if (config.qpay.mock) return false; // mock payments are confirmed via the simulate endpoint
  const token = await getToken();
  const res = await fetch(`${config.qpay.baseUrl}/v2/payment/check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });
  if (!res.ok) throw new Error(`QPay check failed: ${res.status} ${await res.text()}`);
  const d = (await res.json()) as { count: number; rows?: Array<{ payment_status: string }> };
  return (d.rows ?? []).some((r) => r.payment_status === "PAID");
}

export async function cancelInvoice(invoiceId: string): Promise<void> {
  if (config.qpay.mock) return;
  const token = await getToken();
  await fetch(`${config.qpay.baseUrl}/v2/invoice/${encodeURIComponent(invoiceId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

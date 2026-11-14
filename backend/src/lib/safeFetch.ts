import dns from "node:dns/promises";
import net from "node:net";

function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.");
}

/** Fetch a user-supplied URL, refusing internal network targets (basic SSRF guard). */
export async function fetchPublicUrl(raw: string, maxBytes = 5_000_000): Promise<{ body: string; contentType: string }> {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Зөвхөн http/https холбоос");
  const addrs = await dns.lookup(url.hostname, { all: true });
  if (addrs.some((a) => isPrivate(a.address))) throw new Error("Энэ хаягийг ачаалах боломжгүй");

  const res = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "ChatbotKnowledgeImporter/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
    return fetchPublicUrl(new URL(res.headers.get("location")!, url).toString(), maxBytes);
  }
  if (!res.ok) throw new Error(`Сайт ${res.status} алдаа буцаалаа`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("Хуудас хэт том байна");
  return { body: buf.toString("utf8"), contentType: res.headers.get("content-type") ?? "" };
}

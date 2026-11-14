import type { Response } from "express";

/** Tiny Server-Sent-Events hub so the dashboard inbox updates live. */
const clients = new Map<string, Set<Response>>();

export function subscribe(businessId: string, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");
  let set = clients.get(businessId);
  if (!set) clients.set(businessId, (set = new Set()));
  set.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
  res.on("close", () => {
    clearInterval(ping);
    set!.delete(res);
  });
}

export function emit(businessId: string, event: Record<string, unknown>) {
  const set = clients.get(businessId);
  if (!set) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) res.write(data);
}

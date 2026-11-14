import { config } from "../../../config.ts";
import { mockCardProvider } from "./mock.ts";
import type { CardProvider } from "./types.ts";

const providers: Record<string, CardProvider> = {
  mock: mockCardProvider,
  // golomt: golomtCardProvider,  ← implement CardProvider with the bank's e-commerce API
};

export function cardProvider(): CardProvider {
  const p = providers[config.cardProvider];
  if (!p) throw new Error(`Unknown CARD_PROVIDER "${config.cardProvider}"`);
  return p;
}

export type { CardProvider } from "./types.ts";

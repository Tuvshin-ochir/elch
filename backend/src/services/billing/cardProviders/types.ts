/**
 * Card provider adapter. A real bank integration (Golomt, Khan, TDB, ...) implements this
 * with the bank's hosted card page + tokenization API. Card numbers must only ever be
 * entered on the bank's hosted page — our servers keep just the token + last4.
 */
export interface CardSetupResult {
  /** Where to send the user to enter card details (bank hosted page) */
  redirectUrl: string;
}

export type ChargeResult = { ok: true; ref: string } | { ok: false; reason: string };

export interface CardProvider {
  readonly name: string;
  createSetupSession(args: { sessionId: string; amount?: number; description: string }): Promise<CardSetupResult>;
  charge(args: {
    token: string;
    amount: number;
    currency: "MNT";
    description: string;
    /** Same key → bank must not double-charge */
    idempotencyKey: string;
  }): Promise<ChargeResult>;
}

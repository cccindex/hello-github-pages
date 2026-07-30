import { z } from "zod";

export const tokenSchema = z.object({
  symbol: z.string().min(1).max(16),
  name: z.string().min(1).max(80),
  mint: z.string().min(6).max(64),
  decimals: z.number().int().min(0).max(18),
  multiplier: z.number().positive().optional(),
  priceUsd: z.number().positive().nullable().optional(),
  source: z.string().max(80).optional(),
});

const base = {
  title: z.string().min(1).max(140),
  rationale: z.string().min(1).max(600),
  valueCents: z.number().int().positive().max(2500),
};

export const transactionPlanSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("swap"),
    ...base,
    sourceSymbol: z.string().min(1).max(16),
    destinationSymbol: z.string().min(1).max(16),
    amount: z.number().positive(),
    slippageBps: z.number().int().min(10).max(300),
  }),
  z.object({
    type: z.literal("transfer"),
    ...base,
    tokenSymbol: z.string().min(1).max(16),
    amount: z.number().positive(),
    recipient: z.string().min(32).max(64),
  }),
  z.object({
    type: z.literal("world_buy"),
    ...base,
    marketTicker: z.string().min(1).max(160),
    marketTitle: z.string().min(1).max(400),
    outcome: z.enum(["YES", "NO"]),
    marketMint: z.string().min(32).max(64),
    amountUsdc: z.number().positive().max(25),
    slippageBps: z.number().int().min(10).max(300),
  }),
]);

export type TokenDefinition = z.infer<typeof tokenSchema>;
export type TransactionPlan = z.infer<typeof transactionPlanSchema>;

export function atomicAmount(amount: number, decimals: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid token amount.");
  const [whole, fraction = ""] = amount.toFixed(decimals).split(".");
  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0")
  ).toString();
}

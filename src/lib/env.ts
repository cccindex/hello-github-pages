import { z } from "zod";
import { PURCHASE_CONFIG } from "@/lib/constants";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PAYBOX_MODE: z.enum(["mock", "real"]).default("mock"),
  SOLANA_USDC_MINT: z.string().default(PURCHASE_CONFIG.sourceToken.mint),
  ALLOW_REAL_FINANCIAL_EXECUTION: booleanString.default("false"),
  ALLOW_REAL_RECURRING_EXECUTION: booleanString.default("false"),
  PROJECT_EXECUTION_ENABLED: booleanString.default("true"),
  MOCK_PAYBOX_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),
  MOCK_PAYBOX_DELAY_MS: z.coerce.number().int().min(0).max(30_000).default(500),
  MOCK_BTC_PRICE_USD: z.coerce.number().positive().default(65_000),
});

const parsed = schema.parse(process.env);

if (parsed.SOLANA_USDC_MINT !== PURCHASE_CONFIG.sourceToken.mint) {
  throw new Error("SOLANA_USDC_MINT is not Circle's canonical Solana mainnet USDC mint.");
}

if (
  parsed.ALLOW_REAL_RECURRING_EXECUTION &&
  (!parsed.ALLOW_REAL_FINANCIAL_EXECUTION || parsed.PAYBOX_MODE !== "real")
) {
  throw new Error(
    "Recurring real execution requires PAYBOX_MODE=real and ALLOW_REAL_FINANCIAL_EXECUTION=true.",
  );
}

export const env = parsed;

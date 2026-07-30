import { IN_FLIGHT_STATUSES, PURCHASE_CONFIG } from "@/lib/constants";

export type PolicyCheck = {
  key: string;
  passed: boolean;
  message: string;
  enforcementLayer: "APPLICATION" | "PAYBOX" | "UNKNOWN";
};

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reasons: string[];
  checks: PolicyCheck[];
};

export type PolicyInput = {
  isTest: boolean;
  automationStatus: string;
  expiresAt: Date | null;
  credentialExists: boolean;
  credentialGranted: boolean;
  credentialSupportsSolana: boolean;
  sourceMint: string;
  destinationMint: string;
  chain: string;
  amountAtomic: string;
  slippageBps: number;
  successfulOrReservedLastHour: number;
  successfulOrReservedLastDayCents: number;
  successfulOrReservedLifetimeCents: number;
  hasInFlightExecution: boolean;
  idempotencyKeyExists: boolean;
  projectExecutionEnabled: boolean;
  financialExecutionEnabled: boolean;
  usdcBalanceAtomic: bigint;
  solBalanceLamports: bigint;
};

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const checks: PolicyCheck[] = [];
  const add = (
    key: string,
    passed: boolean,
    message: string,
    enforcementLayer: PolicyCheck["enforcementLayer"] = "APPLICATION",
  ) => checks.push({ key, passed, message, enforcementLayer });

  add(
    "automation-state",
    input.isTest || input.automationStatus === "ACTIVE",
    input.isTest ? "Test purchase is permitted before activation." : "Automation is active.",
  );
  add("not-expired", input.isTest || !input.expiresAt || input.expiresAt > new Date(), "Automation has not expired.");
  add("credential-exists", input.credentialExists, "Selected credential exists.");
  add("credential-granted", input.credentialGranted, "Selected credential is granted.");
  add("solana-support", input.credentialSupportsSolana, "Credential supports Solana mainnet.");
  add("source-mint", input.sourceMint === PURCHASE_CONFIG.sourceToken.mint, "Source is canonical Solana USDC.");
  add(
    "destination-mint",
    input.destinationMint === PURCHASE_CONFIG.destinationToken.mint,
    "Destination is the exact cbBTC mint.",
  );
  add("chain", input.chain === PURCHASE_CONFIG.chain, "Chain is Solana mainnet.");
  add("amount", input.amountAtomic === PURCHASE_CONFIG.amountAtomic, "Amount is exactly 1 USDC.");
  add("slippage", input.slippageBps <= PURCHASE_CONFIG.maximumSlippageBps, "Slippage is within the 150 bps ceiling.");
  add("hourly-limit", input.successfulOrReservedLastHour < 12, "Rolling hourly limit has capacity.");
  add(
    "daily-limit",
    input.successfulOrReservedLastDayCents + 100 <= 1200,
    "Rolling 24-hour limit has capacity.",
  );
  add(
    "lifetime-limit",
    input.successfulOrReservedLifetimeCents + 100 <= 2500,
    "Lifetime limit has capacity.",
  );
  add("no-in-flight", !input.hasInFlightExecution, "No other purchase is financially in flight.");
  add("unique-delivery", !input.idempotencyKeyExists, "Idempotency key is unused.");
  add("project-enabled", input.projectExecutionEnabled, "Project execution is enabled.");
  add("financial-mode", input.financialExecutionEnabled, "Current execution mode permits this request.");
  add("usdc-balance", input.usdcBalanceAtomic >= 1_000_000n, "Wallet has at least 1 USDC.");
  add("sol-balance", input.solBalanceLamports >= 5_000n, "Wallet appears to have enough SOL for fees.", "UNKNOWN");

  const failed = checks.filter((check) => !check.passed);
  return {
    allowed: failed.length === 0,
    requiresApproval: input.isTest,
    reasons: failed.map((check) => check.message),
    checks,
  };
}

export function isInFlight(status: string) {
  return (IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

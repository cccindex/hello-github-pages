import { describe, expect, it } from "vitest";
import { PURCHASE_CONFIG } from "@/lib/constants";
import { evaluatePolicy, type PolicyInput } from "@/lib/policy";

function valid(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    isTest: false,
    requiresActiveAutomation: true,
    automationStatus: "ACTIVE",
    expiresAt: new Date(Date.now() + 60_000),
    credentialExists: true,
    credentialGranted: true,
    credentialSupportsSolana: true,
    sourceMint: PURCHASE_CONFIG.sourceToken.mint,
    destinationMint: PURCHASE_CONFIG.destinationToken.mint,
    chain: PURCHASE_CONFIG.chain,
    amountAtomic: PURCHASE_CONFIG.amountAtomic,
    slippageBps: 100,
    successfulOrReservedLastHour: 0,
    successfulOrReservedLastDayCents: 0,
    successfulOrReservedLifetimeCents: 0,
    hasInFlightExecution: false,
    idempotencyKeyExists: false,
    projectExecutionEnabled: true,
    financialExecutionEnabled: true,
    usdcBalanceAtomic: 20_000_000n,
    solBalanceLamports: 50_000_000n,
    ...overrides,
  };
}

describe("purchase policy", () => {
  it("allows the exact fixed purchase", () => {
    expect(evaluatePolicy(valid()).allowed).toBe(true);
  });

  it("explains when real financial execution is disabled", () => {
    const decision = evaluatePolicy(valid({ financialExecutionEnabled: false }));
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain(
      "Real financial execution is disabled in this public prototype.",
    );
  });

  it.each([
    ["wrong amount", { amountAtomic: "2000000" }],
    ["wrong source mint", { sourceMint: "wrong" }],
    ["wrong destination mint", { destinationMint: "wrong" }],
    ["wrong chain", { chain: "ethereum:mainnet" }],
    ["expired", { expiresAt: new Date(0) }],
    ["paused", { automationStatus: "PAUSED" }],
    ["revoked", { credentialGranted: false }],
    ["daily limit", { successfulOrReservedLastDayCents: 1200 }],
    ["lifetime limit", { successfulOrReservedLifetimeCents: 2500 }],
    ["duplicate idempotency key", { idempotencyKeyExists: true }],
    ["pending request", { hasInFlightExecution: true }],
  ] satisfies Array<[string, Partial<PolicyInput>]>)("blocks %s", (_name, overrides) => {
    expect(evaluatePolicy(valid(overrides)).allowed).toBe(false);
  });

  it("allows a manual purchase while recurring automation is paused", () => {
    const decision = evaluatePolicy(
      valid({
        automationStatus: "PAUSED",
        requiresActiveAutomation: false,
      }),
    );
    expect(decision.allowed).toBe(true);
  });
});

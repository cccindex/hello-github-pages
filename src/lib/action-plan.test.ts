import { describe, expect, it } from "vitest";
import { atomicAmount, transactionPlanSchema } from "@/lib/action-plan";

describe("transaction plans", () => {
  it("converts human USDC to atomic units exactly", () => {
    expect(atomicAmount(1.25, 6)).toBe("1250000");
  });

  it("supports eight-decimal raw xStock amounts", () => {
    expect(atomicAmount(0.001, 8)).toBe("100000");
  });

  it("rejects plans over the $25 testing cap", () => {
    expect(() =>
      transactionPlanSchema.parse({
        type: "swap",
        title: "Oversized test",
        rationale: "Should fail.",
        valueCents: 2501,
        sourceSymbol: "USDC",
        destinationSymbol: "AAPLx",
        amount: 25.01,
        slippageBps: 100,
      }),
    ).toThrow();
  });
});

import { createHash, randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { MOCK_WALLETS } from "@/lib/constants";
import type {
  PayboxExecutionRequest,
  PayboxProvider,
  SwapRequest,
} from "@/lib/paybox/provider";

const requests = new Map<string, PayboxExecutionRequest>();
const idempotency = new Map<string, string>();

export class MockPayboxProvider implements PayboxProvider {
  async listCredentials() {
    return MOCK_WALLETS.map((wallet) => ({ ...wallet, chains: [...wallet.chains] }));
  }

  async requestSwap(input: SwapRequest) {
    const existingId = idempotency.get(input.idempotencyKey);
    if (existingId) {
      throw new Error(`Duplicate mock request rejected: ${existingId}`);
    }

    if (env.MOCK_PAYBOX_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, env.MOCK_PAYBOX_DELAY_MS));
    }

    const requestId = `mock_req_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const failed = Math.random() < env.MOCK_PAYBOX_FAILURE_RATE;
    const status = failed
      ? "FAILED"
      : input.requiresApproval
        ? "PENDING_USER_APPROVAL"
        : "SUCCESS";
    const received = Math.floor((1 / env.MOCK_BTC_PRICE_USD) * 100_000_000).toString();
    const result: PayboxExecutionRequest = {
      requestId,
      status,
      receivedCbbtcAtomic: status === "SUCCESS" ? received : undefined,
      transactionSignature:
        status === "SUCCESS"
          ? `mock_${createHash("sha256").update(requestId).digest("hex")}`
          : undefined,
    };
    requests.set(requestId, result);
    idempotency.set(input.idempotencyKey, requestId);
    return result;
  }

  async getRequest(requestId: string) {
    const request = requests.get(requestId);
    if (!request) throw new Error("Mock request not found.");
    return request;
  }

  async approveRequest(requestId: string) {
    const request = await this.getRequest(requestId);
    const received = Math.floor((1 / env.MOCK_BTC_PRICE_USD) * 100_000_000).toString();
    const completed: PayboxExecutionRequest = {
      ...request,
      status: "SUCCESS",
      receivedCbbtcAtomic: received,
      transactionSignature: `mock_${createHash("sha256").update(requestId).digest("hex")}`,
    };
    requests.set(requestId, completed);
    return completed;
  }

  async revokeGrant(credentialId: string) {
    void credentialId;
    return;
  }
}

export const mockPaybox = new MockPayboxProvider();

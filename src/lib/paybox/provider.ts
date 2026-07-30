export type PayboxWallet = {
  id: string;
  name: string;
  address: string;
  granted: boolean;
  chains: string[];
  approvalMode: "ALWAYS_APPROVE" | "AUTONOMOUS";
  usdcBalanceAtomic: string;
  cbbtcBalanceAtomic: string;
  solBalanceLamports: string;
};

export type SwapRequest = {
  credentialId: string;
  idempotencyKey: string;
  sourceMint: string;
  destinationMint: string;
  amountAtomic: string;
  chain: "solana:mainnet";
  slippageBps: number;
  requiresApproval: boolean;
};

export type PayboxExecutionRequest = {
  requestId: string;
  status:
    | "PENDING_USER_APPROVAL"
    | "PENDING_SIGNATURE"
    | "PENDING_CONFIRMATION"
    | "PENDING_SETTLEMENT"
    | "SUCCESS"
    | "DENIED"
    | "FAILED"
    | "UNKNOWN";
  transactionSignature?: string;
  receivedCbbtcAtomic?: string;
  raw?: unknown;
};

export interface PayboxProvider {
  listCredentials(): Promise<PayboxWallet[]>;
  requestSwap(input: SwapRequest): Promise<PayboxExecutionRequest>;
  getRequest(requestId: string): Promise<PayboxExecutionRequest>;
  revokeGrant(credentialId: string): Promise<void>;
}

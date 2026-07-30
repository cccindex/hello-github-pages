import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_URL_STORAGE_KEY = "five-minute-bitcoin-api-url";

export function getApiBaseUrl() {
  if (typeof window === "undefined") return DEFAULT_API_BASE_URL;
  return window.localStorage.getItem(API_URL_STORAGE_KEY) ?? DEFAULT_API_BASE_URL;
}

export function saveApiBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  window.localStorage.setItem(API_URL_STORAGE_KEY, normalized);
}

export type ProductState = {
  mode: "mock" | "real";
  realFinancialExecutionEnabled: boolean;
  realRecurringExecutionEnabled: boolean;
  projectExecutionEnabled: boolean;
  user: { id: string; email: string | null; localUserId: string };
  connection: null | {
    status: string;
    selectedCredentialId: string | null;
    selectedWalletAddress: string | null;
    selectedWalletName: string | null;
    selectedWalletChains: string[];
    approvalMode: string | null;
    usdcBalanceAtomic: string;
    cbbtcBalanceAtomic: string;
    solBalanceLamports: string;
    connectedAt: string | null;
    lastSyncedAt: string | null;
  };
  automation: null | {
    id: string;
    status: string;
    activatedAt: string | null;
    expiresAt: string | null;
    lastRunAt: string | null;
    nextRunAt: string | null;
    dailyLimitCents: number;
    lifetimeLimitCents: number;
  };
  wallets: Array<{
    id: string;
    name: string;
    address: string;
    granted: boolean;
    chains: readonly string[];
    approvalMode: string;
    usdcBalanceAtomic: string;
    solBalanceLamports: string;
  }>;
  metrics: {
    spendTodayCents: number;
    lifetimeSpendCents: number;
    reservedSpendCents: number;
    successfulPurchases: number;
  };
  executions: Array<{
    id: string;
    type: string;
    status: string;
    idempotencyKey: string;
    providerRequestId: string | null;
    transactionSignature: string | null;
    amountAtomic: string;
    displayAmountCents: number;
    receivedCbbtcAtomic: string | null;
    isSpendReserved: boolean;
    policyDecisionJson: {
      allowed?: boolean;
      reasons?: string[];
      checks?: Array<{ key: string; passed: boolean; message: string }>;
    };
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
    transitions: Array<{
      id: string;
      toStatus: string;
      note: string | null;
      createdAt: string;
    }>;
  }>;
};

async function loadState(): Promise<ProductState> {
  const response = await fetch(`${getApiBaseUrl()}/api/state`);
  if (!response.ok) throw new Error("Could not load local state.");
  return response.json();
}

export function useProductState() {
  return useQuery({ queryKey: ["product-state"], queryFn: loadState });
}

export function useProductAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, string>) => {
      const response = await fetch(`${getApiBaseUrl()}/api/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Action failed.");
      return body as ProductState;
    },
    onSuccess: (state) => client.setQueryData(["product-state"], state),
  });
}

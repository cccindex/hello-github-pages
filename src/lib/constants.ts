export const PURCHASE_CONFIG = {
  chain: "solana:mainnet",
  sourceToken: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  destinationToken: {
    symbol: "cbBTC",
    mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
    decimals: 8,
  },
  amountAtomic: "1000000",
  displayAmountCents: 100,
  slippageBps: 100,
  maximumSlippageBps: 150,
} as const;

export const SAFETY_LIMITS = {
  maxPerExecutionCents: 100,
  maxExecutionsPerHour: 12,
  dailyLimitCents: 1200,
  lifetimeLimitCents: 2500,
  expiresAfterHours: 24,
} as const;

export const IN_FLIGHT_STATUSES = [
  "PENDING_USER_APPROVAL",
  "PENDING_SIGNATURE",
  "PENDING_CONFIRMATION",
  "PENDING_SETTLEMENT",
  "UNKNOWN",
] as const;

export const LOCAL_USER_ID = "local-owner";

export const MOCK_WALLETS = [
  {
    id: "mock-credential-personal",
    name: "Personal Solana Wallet",
    address: "8xK4A8BQ2WT8HC5NKdYV6i3hYh5fXy9SL6J44X2m92Lm",
    granted: true,
    chains: ["solana:mainnet"],
    approvalMode: "ALWAYS_APPROVE" as const,
    usdcBalanceAtomic: "20000000",
    solBalanceLamports: "50000000",
  },
  {
    id: "mock-credential-trading",
    name: "Trading Wallet",
    address: "5DpQ2D4R8i7wYq21rHJUX4r3WbJ6m2h8Lh4V7Y3A31Wx",
    granted: false,
    chains: ["solana:mainnet"],
    approvalMode: "ALWAYS_APPROVE" as const,
    usdcBalanceAtomic: "10000000",
    solBalanceLamports: "20000000",
  },
] as const;

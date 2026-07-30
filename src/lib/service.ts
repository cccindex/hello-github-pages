import {
  AutomationStatus,
  ConnectionStatus,
  ExecutionStatus,
  ExecutionType,
  Prisma,
} from "@prisma/client";
import { addHours, subHours } from "date-fns";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  MOCK_WALLETS,
  PURCHASE_CONFIG,
  SAFETY_LIMITS,
} from "@/lib/constants";
import { env } from "@/lib/env";
import {
  atomicAmount,
  transactionPlanSchema,
  type TokenDefinition,
  type TransactionPlan,
} from "@/lib/action-plan";
import { getLiveStockFeed, stockTokens } from "@/lib/live-stocks";
import { evaluatePolicy, isInFlight } from "@/lib/policy";
import { mockPaybox } from "@/lib/paybox/mock-provider";
import {
  callRealPayboxReadTool,
  getRealPayboxRequest,
  listRealPayboxWallets,
  requestRealPayboxAction,
  requestRealPayboxSwap,
} from "@/lib/paybox/real-provider";
import type { PayboxExecutionRequest, PayboxWallet } from "@/lib/paybox/provider";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const CORE_TOKENS: TokenDefinition[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: PURCHASE_CONFIG.sourceToken.mint,
    decimals: 6,
    priceUsd: 1,
    source: "Circle",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    mint: PURCHASE_CONFIG.destinationToken.mint,
    decimals: 8,
    source: "Coinbase",
  },
  {
    symbol: "SOL",
    name: "Solana",
    mint: "native",
    decimals: 9,
    source: "Solana",
  },
];

export async function getTransactionTokenCatalog() {
  try {
    return [...CORE_TOKENS, ...stockTokens(await getLiveStockFeed())];
  } catch {
    return CORE_TOKENS;
  }
}

export async function ensureLocalUser(localUserId: string) {
  return db.user.upsert({
    where: { localUserId },
    update: {},
    create: {
      localUserId,
      email: null,
      payboxConnection: {
        create: {
          status: ConnectionStatus.NOT_CONNECTED,
          selectedWalletChains: [],
        },
      },
      automation: {
        create: {
          status: AutomationStatus.SETUP_REQUIRED,
          sourceMint: PURCHASE_CONFIG.sourceToken.mint,
          destinationMint: PURCHASE_CONFIG.destinationToken.mint,
          maxPerExecutionCents: SAFETY_LIMITS.maxPerExecutionCents,
          maxExecutionsPerHour: SAFETY_LIMITS.maxExecutionsPerHour,
          dailyLimitCents: SAFETY_LIMITS.dailyLimitCents,
          lifetimeLimitCents: SAFETY_LIMITS.lifetimeLimitCents,
        },
      },
    },
    include: { payboxConnection: true, automation: true },
  });
}

export async function getLocalState(localUserId: string) {
  const local = await ensureLocalUser(localUserId);
  const user = await db.user.findUniqueOrThrow({
    where: { id: local.id },
    include: {
      payboxConnection: true,
      automation: true,
      executions: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { transitions: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  const successful = user.executions.filter((item) => item.status === "SUCCESS");
  const reserved = user.executions.filter((item) => item.isSpendReserved && item.status !== "SUCCESS");
  const sinceDay = subHours(new Date(), 24);
  const spendTodayCents = user.executions
    .filter((item) => item.createdAt >= sinceDay && (item.status === "SUCCESS" || item.isSpendReserved))
    .reduce((sum, item) => sum + item.displayAmountCents, 0);
  const lifetimeSpendCents = successful.reduce((sum, item) => sum + item.displayAmountCents, 0);
  const hasRealPayboxAuthorization = Boolean(user.payboxConnection?.oauthAccessToken);
  let wallets: PayboxWallet[] =
    env.PAYBOX_MODE === "real"
      ? []
      : MOCK_WALLETS.map((wallet) => ({
          ...wallet,
          chains: [...wallet.chains],
        }));
  if (
    env.PAYBOX_MODE === "real" &&
    user.payboxConnection?.status === ConnectionStatus.CONNECTED &&
    hasRealPayboxAuthorization
  ) {
    const connection = user.payboxConnection;
    if (
      connection.selectedCredentialId &&
      connection.selectedWalletAddress &&
      connection.selectedWalletName
    ) {
      wallets = [{
        id: connection.selectedCredentialId,
        name: connection.selectedWalletName,
        address: connection.selectedWalletAddress,
        granted: true,
        chains: connection.selectedWalletChains,
        approvalMode: connection.approvalMode ?? "ALWAYS_APPROVE",
        usdcBalanceAtomic: connection.usdcBalanceAtomic.toString(),
        cbbtcBalanceAtomic: connection.cbbtcBalanceAtomic.toString(),
        solBalanceLamports: connection.solBalanceLamports.toString(),
      }];
    } else {
      try {
        wallets = await listRealPayboxWallets(localUserId);
      } catch {
        wallets = [];
      }
    }
  }

  return {
    mode: env.PAYBOX_MODE,
    aiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    realFinancialExecutionEnabled: env.ALLOW_REAL_FINANCIAL_EXECUTION,
    realRecurringExecutionEnabled: env.ALLOW_REAL_RECURRING_EXECUTION,
    projectExecutionEnabled: env.PROJECT_EXECUTION_ENABLED,
    user: {
      id: user.id,
      email: user.email,
      localUserId: user.localUserId,
    },
    connection: user.payboxConnection
      ? {
          status:
            env.PAYBOX_MODE === "real" && !hasRealPayboxAuthorization
              ? ConnectionStatus.NOT_CONNECTED
              : user.payboxConnection.status,
          selectedCredentialId: user.payboxConnection.selectedCredentialId,
          selectedWalletAddress: user.payboxConnection.selectedWalletAddress,
          selectedWalletName: user.payboxConnection.selectedWalletName,
          selectedWalletChains: user.payboxConnection.selectedWalletChains,
          approvalMode: user.payboxConnection.approvalMode,
          usdcBalanceAtomic: user.payboxConnection.usdcBalanceAtomic.toString(),
          cbbtcBalanceAtomic: user.payboxConnection.cbbtcBalanceAtomic.toString(),
          solBalanceLamports: user.payboxConnection.solBalanceLamports.toString(),
          connectedAt: user.payboxConnection.connectedAt,
          lastSyncedAt: user.payboxConnection.lastSyncedAt,
        }
      : null,
    automation: user.automation,
    wallets,
    metrics: {
      spendTodayCents,
      lifetimeSpendCents,
      reservedSpendCents: reserved.reduce((sum, item) => sum + item.displayAmountCents, 0),
      successfulPurchases: successful.length,
    },
    executions: user.executions.map((execution) => ({
      ...execution,
      receivedCbbtcAtomic: execution.receivedCbbtcAtomic?.toString() ?? null,
    })),
  };
}

export async function connectMockPaybox(localUserId: string) {
  const user = await ensureLocalUser(localUserId);
  await db.$transaction([
    db.payboxConnection.update({
      where: { userId: user.id },
      data: {
        status: ConnectionStatus.CONNECTED,
        externalUserId: "mock-paybox-user",
        connectedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    }),
    db.automation.update({
      where: { userId: user.id },
      data: { status: AutomationStatus.SETUP_REQUIRED },
    }),
  ]);
}

export async function selectMockWallet(localUserId: string, credentialId: string) {
  const user = await ensureLocalUser(localUserId);
  const wallet = MOCK_WALLETS.find((item) => item.id === credentialId);
  if (!wallet) throw new Error("Wallet credential not found.");
  if (!wallet.granted) throw new Error("This mock wallet has not been granted yet.");

  await db.$transaction([
    db.payboxConnection.update({
      where: { userId: user.id },
      data: {
        selectedCredentialId: wallet.id,
        selectedWalletAddress: wallet.address,
        selectedWalletName: wallet.name,
        selectedWalletChains: [...wallet.chains],
        approvalMode: "ALWAYS_APPROVE",
        usdcBalanceAtomic: BigInt(wallet.usdcBalanceAtomic),
        solBalanceLamports: BigInt(wallet.solBalanceLamports),
        cbbtcBalanceAtomic: 0n,
        lastSyncedAt: new Date(),
      },
    }),
    db.automation.update({
      where: { userId: user.id },
      data: { status: AutomationStatus.TEST_REQUIRED },
    }),
  ]);
}

async function transition(
  executionId: string,
  fromStatus: ExecutionStatus | null,
  toStatus: ExecutionStatus,
  note?: string,
) {
  await db.executionTransition.create({
    data: { executionId, fromStatus, toStatus, note },
  });
}

async function countsFor(userId: string) {
  const executions = await db.execution.findMany({ where: { userId } });
  const countable = executions.filter(
    (item) => item.status === "SUCCESS" || item.isSpendReserved,
  );
  const now = new Date();
  return {
    lastHour: countable.filter((item) => item.createdAt >= subHours(now, 1)).length,
    lastDayCents: countable
      .filter((item) => item.createdAt >= subHours(now, 24))
      .reduce((sum, item) => sum + item.displayAmountCents, 0),
    lifetimeCents: countable.reduce((sum, item) => sum + item.displayAmountCents, 0),
    hasInFlight: executions.some((item) => isInFlight(item.status)),
  };
}

async function completeSuccessfulExecution(
  executionId: string,
  providerRequestId: string,
  transactionSignature: string,
  receivedCbbtcAtomic: bigint,
) {
  const execution = await db.execution.findUniqueOrThrow({ where: { id: executionId } });
  await db.$transaction([
    db.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.SUCCESS,
        providerRequestId,
        providerResponseJson: asJson({ status: "SUCCESS", mode: "mock" }),
        transactionSignature,
        receivedCbbtcAtomic,
        isSpendReserved: false,
        completedAt: new Date(),
      },
    }),
    db.executionTransition.create({
      data: {
        executionId,
        fromStatus: execution.status,
        toStatus: ExecutionStatus.SUCCESS,
        note: "Mock provider completed the swap and balances were updated.",
      },
    }),
    db.payboxConnection.update({
      where: { userId: execution.userId },
      data: {
        usdcBalanceAtomic: { decrement: 1_000_000n },
        cbbtcBalanceAtomic: { increment: receivedCbbtcAtomic },
        approvalMode: "AUTONOMOUS",
        lastSyncedAt: new Date(),
      },
    }),
  ]);

  if (execution.type === ExecutionType.TEST_PURCHASE) {
    await db.automation.update({
      where: { id: execution.automationId },
      data: { status: AutomationStatus.READY },
    });
  }
}

async function completeRealSuccessfulExecution(
  executionId: string,
  provider: PayboxExecutionRequest,
) {
  const execution = await db.execution.findUniqueOrThrow({
    where: { id: executionId },
    include: { user: { include: { payboxConnection: true } } },
  });
  const connection = execution.user.payboxConnection!;
  let wallet:
    | Awaited<ReturnType<typeof listRealPayboxWallets>>[number]
    | undefined;
  try {
    wallet = (await listRealPayboxWallets(execution.user.localUserId)).find(
      (item) => item.id === connection.selectedCredentialId,
    );
  } catch {
    wallet = undefined;
  }

  const nextCbbtcBalance = wallet
    ? BigInt(wallet.cbbtcBalanceAtomic)
    : connection.cbbtcBalanceAtomic;
  const balanceIncrease =
    nextCbbtcBalance > connection.cbbtcBalanceAtomic
      ? nextCbbtcBalance - connection.cbbtcBalanceAtomic
      : 0n;
  const receivedCbbtcAtomic = provider.receivedCbbtcAtomic
    ? BigInt(provider.receivedCbbtcAtomic)
    : balanceIncrease;

  await db.$transaction([
    db.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.SUCCESS,
        providerRequestId: provider.requestId,
        providerResponseJson: asJson(provider.raw ?? provider),
        transactionSignature:
          provider.transactionSignature ?? execution.transactionSignature,
        receivedCbbtcAtomic,
        isSpendReserved: false,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date(),
      },
    }),
    db.executionTransition.create({
      data: {
        executionId,
        fromStatus: execution.status,
        toStatus: ExecutionStatus.SUCCESS,
        note: "Paybox reported the real swap as successful.",
      },
    }),
    db.payboxConnection.update({
      where: { userId: execution.userId },
      data: wallet
        ? {
            usdcBalanceAtomic: BigInt(wallet.usdcBalanceAtomic),
            cbbtcBalanceAtomic: BigInt(wallet.cbbtcBalanceAtomic),
            solBalanceLamports: BigInt(wallet.solBalanceLamports),
            lastSyncedAt: new Date(),
          }
        : { lastSyncedAt: new Date() },
    }),
  ]);

  if (execution.type === ExecutionType.TEST_PURCHASE) {
    await db.automation.update({
      where: { id: execution.automationId },
      data: { status: AutomationStatus.READY },
    });
  }
}

export async function createExecution(
  localUserId: string,
  type: ExecutionType,
  scheduledFor = new Date(),
) {
  const user = await ensureLocalUser(localUserId);
  const connection = user.payboxConnection!;
  const automation = user.automation!;
  const isTest = type === ExecutionType.TEST_PURCHASE;
  const idempotencyKey =
    type === ExecutionType.SCHEDULED_PURCHASE
      ? `five-minute-bitcoin:${automation.id}:${scheduledFor.toISOString()}`
      : `${type.toLowerCase()}:${automation.id}:${randomUUID()}`;

  const existing = await db.execution.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  const counts = await countsFor(user.id);
  const decision = evaluatePolicy({
    isTest,
    requiresActiveAutomation: type === ExecutionType.SCHEDULED_PURCHASE,
    automationStatus: automation.status,
    expiresAt: automation.expiresAt,
    credentialExists: Boolean(connection.selectedCredentialId),
    credentialGranted: connection.status === ConnectionStatus.CONNECTED,
    credentialSupportsSolana: connection.selectedWalletChains.includes("solana:mainnet"),
    sourceMint: automation.sourceMint,
    destinationMint: automation.destinationMint,
    chain: automation.chain,
    amountAtomic: automation.amountAtomic,
    slippageBps: PURCHASE_CONFIG.slippageBps,
    successfulOrReservedLastHour: counts.lastHour,
    successfulOrReservedLastDayCents: counts.lastDayCents,
    successfulOrReservedLifetimeCents: counts.lifetimeCents,
    hasInFlightExecution: counts.hasInFlight,
    idempotencyKeyExists: false,
    projectExecutionEnabled: env.PROJECT_EXECUTION_ENABLED,
    financialExecutionEnabled:
      env.PAYBOX_MODE === "mock" ||
      (type === ExecutionType.SCHEDULED_PURCHASE
        ? env.ALLOW_REAL_RECURRING_EXECUTION
        : env.ALLOW_REAL_FINANCIAL_EXECUTION),
    usdcBalanceAtomic: connection.usdcBalanceAtomic,
    solBalanceLamports: connection.solBalanceLamports,
  });

  const blockedStatus =
    counts.hasInFlight && type === ExecutionType.SCHEDULED_PURCHASE
      ? ExecutionStatus.SKIPPED_PREVIOUS_EXECUTION_PENDING
      : ExecutionStatus.BLOCKED_BY_POLICY;
  const initialStatus = decision.allowed
    ? ExecutionStatus.EVALUATING_POLICY
    : blockedStatus;

  const execution = await db.execution.create({
    data: {
      userId: user.id,
      automationId: automation.id,
      type,
      idempotencyKey,
      scheduledFor,
      status: initialStatus,
      policyDecisionJson: asJson(decision),
      errorCode: decision.allowed ? null : "POLICY_BLOCKED",
      errorMessage: decision.allowed ? null : decision.reasons.join(" "),
      completedAt: decision.allowed ? null : new Date(),
      transitions: {
        create: {
          toStatus: initialStatus,
          note: decision.allowed
            ? "Policy evaluation passed."
            : decision.reasons.join(" "),
        },
      },
    },
  });

  if (!decision.allowed) return execution;
  let provider: PayboxExecutionRequest;
  try {
    const swapInput = {
      credentialId: connection.selectedCredentialId!,
      idempotencyKey,
      sourceMint: PURCHASE_CONFIG.sourceToken.mint,
      destinationMint: PURCHASE_CONFIG.destinationToken.mint,
      amountAtomic: PURCHASE_CONFIG.amountAtomic,
      chain: PURCHASE_CONFIG.chain,
      slippageBps: PURCHASE_CONFIG.slippageBps,
      requiresApproval: isTest,
    } as const;
    provider =
      env.PAYBOX_MODE === "mock"
        ? await mockPaybox.requestSwap(swapInput)
        : await requestRealPayboxSwap(localUserId, swapInput);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Paybox request failed before a response was stored.";
    await db.execution.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.UNKNOWN,
        errorCode: "PROVIDER_RESPONSE_UNKNOWN",
        errorMessage: message,
        isSpendReserved: true,
      },
    });
    await transition(
      execution.id,
      ExecutionStatus.EVALUATING_POLICY,
      ExecutionStatus.UNKNOWN,
      "The provider response was not conclusive. No duplicate request will be sent.",
    );
    throw error;
  }

  await db.execution.update({
    where: { id: execution.id },
    data: {
      providerRequestId: provider.requestId,
      status: provider.status,
      isSpendReserved: !["FAILED", "DENIED"].includes(provider.status),
      providerResponseJson: asJson(
        provider.raw ?? { requestId: provider.requestId, status: provider.status },
      ),
      completedAt: ["FAILED", "DENIED"].includes(provider.status)
        ? new Date()
        : null,
    },
  });
  await transition(
    execution.id,
    ExecutionStatus.EVALUATING_POLICY,
    provider.status,
    "Exactly one provider request was created; $1 is now reserved.",
  );

  if (provider.status === "SUCCESS") {
    if (env.PAYBOX_MODE === "mock") {
      await completeSuccessfulExecution(
        execution.id,
        provider.requestId,
        provider.transactionSignature!,
        BigInt(provider.receivedCbbtcAtomic!),
      );
    } else {
      await completeRealSuccessfulExecution(execution.id, provider);
    }
  }

  return db.execution.findUniqueOrThrow({ where: { id: execution.id } });
}

export async function createPlannedExecution(
  localUserId: string,
  rawPlan: TransactionPlan,
) {
  if (env.PAYBOX_MODE !== "real") {
    throw new Error("General transaction plans require the real Paybox connection.");
  }
  if (!env.PROJECT_EXECUTION_ENABLED || !env.ALLOW_REAL_FINANCIAL_EXECUTION) {
    throw new Error("Real transaction execution is disabled on the server.");
  }

  const plan = transactionPlanSchema.parse(rawPlan);
  const user = await ensureLocalUser(localUserId);
  const connection = user.payboxConnection!;
  if (
    connection.status !== ConnectionStatus.CONNECTED ||
    !connection.selectedCredentialId ||
    !connection.selectedWalletChains.includes("solana:mainnet")
  ) {
    throw new Error("Connect and select a granted Solana wallet first.");
  }
  const counts = await countsFor(user.id);
  if (counts.hasInFlight) {
    throw new Error("Finish the existing Paybox request before creating another transaction.");
  }

  const catalog = await getTransactionTokenCatalog();
  const token = (symbol: string) => {
    const match = catalog.find(
      (item) => item.symbol.toLowerCase() === symbol.toLowerCase(),
    );
    if (!match) throw new Error(`${symbol} is not in the verified transaction catalog.`);
    return match;
  };

  let toolName: "request_swap" | "request_transfer" | "world_buy_outcome";
  let toolInput: Record<string, unknown>;
  let amountAtomic: string;
  let displayAmountCents: number;

  if (plan.type === "swap") {
    const source = token(plan.sourceSymbol);
    const destination = token(plan.destinationSymbol);
    if (source.mint === destination.mint) throw new Error("Choose two different assets.");
    amountAtomic = atomicAmount(
      plan.amount / (source.multiplier ?? 1),
      source.decimals,
    );
    displayAmountCents = Math.max(
      1,
      Math.round(plan.amount * (source.priceUsd ?? plan.valueCents / 100) * 100),
    );
    toolName = "request_swap";
    toolInput = {
      credential_id: connection.selectedCredentialId,
      src_chain: "solana:mainnet",
      src_token: source.mint,
      dst_token: destination.mint,
      amount: amountAtomic,
      swap_direction: "exact-amount-in",
      slippage_bps: plan.slippageBps,
      value_cents: displayAmountCents,
    };
    if (
      source.symbol === "USDC" &&
      BigInt(amountAtomic) > connection.usdcBalanceAtomic
    ) {
      throw new Error("The selected wallet does not have enough USDC.");
    }
  } else if (plan.type === "transfer") {
    const asset = token(plan.tokenSymbol);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(plan.recipient)) {
      throw new Error("The recipient is not a valid Solana address.");
    }
    amountAtomic = atomicAmount(
      plan.amount / (asset.multiplier ?? 1),
      asset.decimals,
    );
    displayAmountCents = Math.max(
      1,
      Math.round(plan.amount * (asset.priceUsd ?? plan.valueCents / 100) * 100),
    );
    toolName = "request_transfer";
    toolInput = {
      credential_id: connection.selectedCredentialId,
      chain: "solana:mainnet",
      to: plan.recipient,
      amount: amountAtomic,
      ...(asset.mint === "native" ? {} : { token: asset.mint }),
      value_cents: displayAmountCents,
    };
  } else {
    const marketCheck = await callRealPayboxReadTool(
      localUserId,
      "world_orderbook",
      { id: plan.marketMint, by_mint: true },
    ) as { isError?: boolean; content?: Array<{ text?: string }> };
    if (marketCheck.isError) {
      throw new Error(
        marketCheck.content?.find((item) => item.text)?.text ??
          "Paybox could not verify this World outcome mint.",
      );
    }
    amountAtomic = atomicAmount(plan.amountUsdc, 6);
    displayAmountCents = Math.round(plan.amountUsdc * 100);
    if (BigInt(amountAtomic) > connection.usdcBalanceAtomic) {
      throw new Error("The selected wallet does not have enough USDC.");
    }
    toolName = "world_buy_outcome";
    toolInput = {
      credential_id: connection.selectedCredentialId,
      market_mint: plan.marketMint,
      size: amountAtomic,
      slippage_bps: plan.slippageBps,
      value_cents: displayAmountCents,
    };
  }

  if (displayAmountCents > 2500) {
    throw new Error("This testing build caps each confirmed transaction at $25.");
  }

  const idempotencyKey = `planned:${user.automation!.id}:${randomUUID()}`;
  const execution = await db.execution.create({
    data: {
      userId: user.id,
      automationId: user.automation!.id,
      type: ExecutionType.MANUAL_PURCHASE,
      idempotencyKey,
      status: ExecutionStatus.EVALUATING_POLICY,
      amountAtomic,
      displayAmountCents,
      policyDecisionJson: asJson({
        allowed: true,
        plan,
        toolName,
        toolInput,
        checks: [
          { key: "wallet", passed: true, message: "Granted Solana wallet selected." },
          { key: "amount", passed: true, message: "Transaction is within the $25 test cap." },
          { key: "review", passed: true, message: "User confirmed the exact visible plan." },
        ],
      }),
      transitions: {
        create: {
          toStatus: ExecutionStatus.EVALUATING_POLICY,
          note: `Validated ${toolName} plan and bound it to the selected Paybox wallet.`,
        },
      },
    },
  });

  let provider: PayboxExecutionRequest;
  try {
    provider = await requestRealPayboxAction(
      localUserId,
      toolName,
      toolInput,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Paybox did not return a conclusive response.";
    await db.execution.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.UNKNOWN,
        errorCode: "PROVIDER_RESPONSE_UNKNOWN",
        errorMessage: message,
        isSpendReserved: true,
      },
    });
    await transition(
      execution.id,
      ExecutionStatus.EVALUATING_POLICY,
      ExecutionStatus.UNKNOWN,
      "The provider response was inconclusive; the action will not be submitted again.",
    );
    throw error;
  }

  const raw =
    provider.raw && typeof provider.raw === "object" && !Array.isArray(provider.raw)
      ? provider.raw as Record<string, unknown>
      : { payboxResult: provider.raw ?? provider };
  await db.execution.update({
    where: { id: execution.id },
    data: {
      providerRequestId: provider.requestId,
      status: provider.status,
      isSpendReserved: !["FAILED", "DENIED"].includes(provider.status),
      providerResponseJson: asJson({
        ...raw,
        _host: { plan, toolName, toolInput },
      }),
      completedAt: ["FAILED", "DENIED"].includes(provider.status)
        ? new Date()
        : null,
    },
  });
  await transition(
    execution.id,
    ExecutionStatus.EVALUATING_POLICY,
    provider.status,
    `Exactly one ${toolName} request was created in Paybox.`,
  );

  if (provider.status === "SUCCESS") {
    await completeRealSuccessfulExecution(execution.id, provider);
  }
  return db.execution.findUniqueOrThrow({ where: { id: execution.id } });
}

export async function refreshExecution(localUserId: string, executionId: string) {
  const execution = await db.execution.findUniqueOrThrow({
    where: { id: executionId },
    include: { user: true },
  });
  if (execution.user.localUserId !== localUserId) throw new Error("Execution not found.");
  if (!execution.providerRequestId) {
    throw new Error("This execution has no Paybox request to refresh.");
  }
  if (env.PAYBOX_MODE === "mock") return execution;
  if (!isInFlight(execution.status)) return execution;

  const provider = await getRealPayboxRequest(localUserId, execution.providerRequestId);
  if (provider.status === "SUCCESS") {
    await completeRealSuccessfulExecution(execution.id, provider);
    return db.execution.findUniqueOrThrow({ where: { id: execution.id } });
  }

  const terminal = provider.status === "FAILED" || provider.status === "DENIED";
  await db.execution.update({
    where: { id: execution.id },
    data: {
      status: provider.status,
      providerResponseJson: asJson(provider.raw ?? provider),
      isSpendReserved: !terminal,
      completedAt: terminal ? new Date() : null,
      errorCode: terminal ? `PAYBOX_${provider.status}` : null,
      errorMessage: terminal ? `Paybox ended this request as ${provider.status.toLowerCase()}.` : null,
    },
  });
  if (provider.status !== execution.status) {
    await transition(
      execution.id,
      execution.status,
      provider.status,
      `Paybox request is now ${provider.status.toLowerCase().replaceAll("_", " ")}.`,
    );
  }
  return db.execution.findUniqueOrThrow({ where: { id: execution.id } });
}

export async function approveTestPurchase(localUserId: string, executionId: string) {
  const execution = await db.execution.findUniqueOrThrow({
    where: { id: executionId },
    include: { user: true },
  });
  if (execution.user.localUserId !== localUserId) throw new Error("Execution not found.");
  if (
    execution.type !== ExecutionType.TEST_PURCHASE ||
    execution.status !== ExecutionStatus.PENDING_USER_APPROVAL ||
    !execution.providerRequestId
  ) {
    throw new Error("This execution is not awaiting test-purchase approval.");
  }
  const result = await mockPaybox.approveRequest(execution.providerRequestId);
  await completeSuccessfulExecution(
    execution.id,
    result.requestId,
    result.transactionSignature!,
    BigInt(result.receivedCbbtcAtomic!),
  );
}

export async function activateAutomation(localUserId: string, confirmation: string) {
  if (confirmation !== "ACTIVATE") throw new Error("Type ACTIVATE to continue.");
  const user = await ensureLocalUser(localUserId);
  if (user.automation?.status !== AutomationStatus.READY) {
    throw new Error("Complete the successful test purchase first.");
  }
  const activatedAt = new Date();
  await db.automation.update({
    where: { userId: user.id },
    data: {
      status: AutomationStatus.ACTIVE,
      activatedAt,
      expiresAt: addHours(activatedAt, SAFETY_LIMITS.expiresAfterHours),
      nextRunAt: nextFiveMinuteBoundary(activatedAt),
    },
  });
}

export async function setAutomationStatus(
  localUserId: string,
  action: "pause" | "resume",
) {
  const user = await ensureLocalUser(localUserId);
  const automation = user.automation!;
  if (action === "pause") {
    await db.automation.update({
      where: { id: automation.id },
      data: { status: AutomationStatus.PAUSED },
    });
    return;
  }
  if (!automation.expiresAt || automation.expiresAt <= new Date()) {
    throw new Error("This 24-hour automation has expired.");
  }
  if (user.payboxConnection?.status !== ConnectionStatus.CONNECTED) {
    throw new Error("Reconnect or grant the Paybox wallet before resuming.");
  }
  await db.automation.update({
    where: { id: automation.id },
    data: { status: AutomationStatus.ACTIVE, nextRunAt: nextFiveMinuteBoundary(new Date()) },
  });
}

export async function revokeAccess(localUserId: string) {
  const user = await ensureLocalUser(localUserId);
  if (env.PAYBOX_MODE === "mock" && user.payboxConnection?.selectedCredentialId) {
    await mockPaybox.revokeGrant(user.payboxConnection.selectedCredentialId);
  }
  await db.$transaction([
    db.payboxConnection.update({
      where: { userId: user.id },
      data: {
        status: ConnectionStatus.REVOKED,
        approvalMode: null,
        selectedCredentialId: null,
        selectedWalletAddress: null,
        selectedWalletName: null,
        selectedWalletChains: [],
        oauthAccessToken: null,
        oauthRefreshToken: null,
        oauthTokenExpiresAt: null,
        oauthScopes: [],
      },
    }),
    db.automation.update({
      where: { userId: user.id },
      data: { status: AutomationStatus.BLOCKED },
    }),
  ]);
}

export async function resetLocalData(localUserId: string) {
  const user = await db.user.findUnique({ where: { localUserId } });
  if (user) await db.user.delete({ where: { id: user.id } });
  await ensureLocalUser(localUserId);
}

export function nextFiveMinuteBoundary(now: Date) {
  const value = new Date(now);
  value.setUTCSeconds(0, 0);
  value.setUTCMinutes(Math.floor(value.getUTCMinutes() / 5) * 5 + 5);
  return value;
}

export async function runDueAutomations(now = new Date()) {
  const due = await db.automation.findMany({
    where: {
      status: AutomationStatus.ACTIVE,
      nextRunAt: { lte: now },
    },
  });

  const results = [];
  for (const automation of due) {
    const scheduledFor = automation.nextRunAt ?? now;
    const user = await db.user.findUniqueOrThrow({ where: { id: automation.userId } });
    const result = await createExecution(
      user.localUserId,
      ExecutionType.SCHEDULED_PURCHASE,
      scheduledFor,
    );
    await db.automation.update({
      where: { id: automation.id },
      data: {
        lastRunAt: scheduledFor,
        nextRunAt: nextFiveMinuteBoundary(now),
      },
    });
    results.push(result);
  }
  return results;
}

export async function triggerSchedulerDelivery(
  localUserId: string,
  scheduledFor?: Date,
) {
  const user = await ensureLocalUser(localUserId);
  const automation = user.automation!;
  const deliveryTime = scheduledFor ?? automation.nextRunAt ?? nextFiveMinuteBoundary(new Date());
  const result = await createExecution(
    localUserId,
    ExecutionType.SCHEDULED_PURCHASE,
    deliveryTime,
  );
  await db.automation.update({
    where: { id: automation.id },
    data: {
      lastRunAt: deliveryTime,
      nextRunAt: nextFiveMinuteBoundary(new Date()),
    },
  });
  return result;
}

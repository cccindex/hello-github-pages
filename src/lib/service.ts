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
  LOCAL_USER_ID,
  MOCK_WALLETS,
  PURCHASE_CONFIG,
  SAFETY_LIMITS,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { evaluatePolicy, isInFlight } from "@/lib/policy";
import { mockPaybox } from "@/lib/paybox/mock-provider";
import { listRealPayboxWallets } from "@/lib/paybox/real-provider";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function ensureLocalUser() {
  return db.user.upsert({
    where: { localUserId: LOCAL_USER_ID },
    update: {},
    create: {
      localUserId: LOCAL_USER_ID,
      email: "local@five-minute-bitcoin.test",
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

export async function getLocalState() {
  const local = await ensureLocalUser();
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
  const wallets =
    env.PAYBOX_MODE === "real"
      ? user.payboxConnection?.status === ConnectionStatus.CONNECTED &&
        hasRealPayboxAuthorization
        ? await listRealPayboxWallets()
        : []
      : [...MOCK_WALLETS];

  return {
    mode: env.PAYBOX_MODE,
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

export async function connectMockPaybox() {
  const user = await ensureLocalUser();
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

export async function selectMockWallet(credentialId: string) {
  const user = await ensureLocalUser();
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

export async function createExecution(
  type: ExecutionType,
  scheduledFor = new Date(),
) {
  const user = await ensureLocalUser();
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
      env.PAYBOX_MODE === "mock" || env.ALLOW_REAL_FINANCIAL_EXECUTION,
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
  if (env.PAYBOX_MODE !== "mock") {
    await db.execution.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.BLOCKED_BY_POLICY,
        errorCode: "REAL_PROVIDER_NOT_AUTHENTICATED",
        errorMessage:
          "Paybox OAuth discovery is available, but an authenticated tools/list session has not been configured.",
        completedAt: new Date(),
      },
    });
    await transition(
      execution.id,
      ExecutionStatus.EVALUATING_POLICY,
      ExecutionStatus.BLOCKED_BY_POLICY,
      "Stopped before any financial request: real provider authentication is incomplete.",
    );
    return execution;
  }

  const provider = await mockPaybox.requestSwap({
    credentialId: connection.selectedCredentialId!,
    idempotencyKey,
    sourceMint: PURCHASE_CONFIG.sourceToken.mint,
    destinationMint: PURCHASE_CONFIG.destinationToken.mint,
    amountAtomic: PURCHASE_CONFIG.amountAtomic,
    chain: PURCHASE_CONFIG.chain,
    slippageBps: PURCHASE_CONFIG.slippageBps,
    requiresApproval: isTest,
  });

  await db.execution.update({
    where: { id: execution.id },
    data: {
      providerRequestId: provider.requestId,
      status: provider.status,
      isSpendReserved: provider.status !== "FAILED",
      providerResponseJson: asJson({ requestId: provider.requestId, status: provider.status }),
    },
  });
  await transition(
    execution.id,
    ExecutionStatus.EVALUATING_POLICY,
    provider.status,
    "Exactly one provider request was created; $1 is now reserved.",
  );

  if (provider.status === "SUCCESS") {
    await completeSuccessfulExecution(
      execution.id,
      provider.requestId,
      provider.transactionSignature!,
      BigInt(provider.receivedCbbtcAtomic!),
    );
  }

  return db.execution.findUniqueOrThrow({ where: { id: execution.id } });
}

export async function approveTestPurchase(executionId: string) {
  const execution = await db.execution.findUniqueOrThrow({ where: { id: executionId } });
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

export async function activateAutomation(confirmation: string) {
  if (confirmation !== "ACTIVATE") throw new Error("Type ACTIVATE to continue.");
  const user = await ensureLocalUser();
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

export async function setAutomationStatus(action: "pause" | "resume") {
  const user = await ensureLocalUser();
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

export async function revokeAccess() {
  const user = await ensureLocalUser();
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

export async function resetLocalData() {
  const user = await db.user.findUnique({ where: { localUserId: LOCAL_USER_ID } });
  if (user) await db.user.delete({ where: { id: user.id } });
  await ensureLocalUser();
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
    const result = await createExecution(ExecutionType.SCHEDULED_PURCHASE, scheduledFor);
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

export async function triggerSchedulerDelivery(scheduledFor?: Date) {
  const user = await ensureLocalUser();
  const automation = user.automation!;
  const deliveryTime = scheduledFor ?? automation.nextRunAt ?? nextFiveMinuteBoundary(new Date());
  const result = await createExecution(ExecutionType.SCHEDULED_PURCHASE, deliveryTime);
  await db.automation.update({
    where: { id: automation.id },
    data: {
      lastRunAt: deliveryTime,
      nextRunAt: nextFiveMinuteBoundary(new Date()),
    },
  });
  return result;
}

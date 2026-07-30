import { ApprovalMode, AutomationStatus, ConnectionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { PURCHASE_CONFIG } from "@/lib/constants";
import { PayboxMcpClient } from "@/lib/paybox/mcp-client";
import { getPayboxAccessToken } from "@/lib/paybox/oauth";
import type {
  PayboxExecutionRequest,
  PayboxWallet,
  SwapRequest,
} from "@/lib/paybox/provider";

const WALLET_SIGN_RESOURCE = "ui://paybox/wallet-sign?v=72b844fead9cd20c";

type CredentialList = {
  credentials?: Array<{
    approval_mode?: string;
    credential_id: string;
    kind: string;
    metadata?: { address?: string; chains?: string[] };
    name?: string;
  }>;
};

type Portfolio = {
  items?: Array<{
    balance?: string;
    symbol?: string;
    tokenAddress?: string;
  }>;
};

type ToolResult = {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
  _meta?: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nestedRecord(value: unknown, ...keys: string[]) {
  let current = record(value);
  for (const key of keys) current = record(current[key]);
  return current;
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function structuredResult(result: ToolResult) {
  if (result.structuredContent) return record(result.structuredContent);
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) return {};
  try {
    return record(JSON.parse(text));
  } catch {
    return { text };
  }
}

function normalizeRequest(result: ToolResult): PayboxExecutionRequest {
  const value = structuredResult(result);
  const request = record(value.request);
  const output = nestedRecord(value, "output", "value");
  const statusValue = firstString(value.status, request.status)?.toLowerCase();
  const status: PayboxExecutionRequest["status"] =
    statusValue === "pending_approval"
      ? "PENDING_USER_APPROVAL"
      : statusValue === "pending_signature"
        ? "PENDING_SIGNATURE"
        : statusValue === "pending_confirmation"
          ? "PENDING_CONFIRMATION"
          : statusValue === "pending_settlement"
            ? "PENDING_SETTLEMENT"
            : statusValue === "success"
              ? "SUCCESS"
              : statusValue === "denied"
                ? "DENIED"
                : statusValue === "error"
                  ? "FAILED"
                  : "UNKNOWN";
  const requestId = firstString(value.request_id, request.request_id, value.requestId);
  if (!requestId) throw new Error("Paybox did not return a request ID.");
  return {
    requestId,
    status,
    transactionSignature: firstString(
      value.transaction_signature,
      value.transaction_hash,
      output.transaction_signature,
      output.transaction_hash,
      output.signature,
      output.tx_hash,
    ),
    receivedCbbtcAtomic: firstString(
      value.received_amount,
      output.received_amount,
      output.amount_out,
      output.dst_amount,
    ),
    raw: result,
  };
}

async function initializedClient(localUserId: string, accessToken?: string) {
  const client = new PayboxMcpClient(
    accessToken ?? (await getPayboxAccessToken(localUserId)),
  );
  await client.initialize();
  return client;
}

export async function inspectRealPayboxTools(accessToken: string) {
  const client = new PayboxMcpClient(accessToken);
  await client.initialize();
  const result = (await client.listTools()) as {
    tools?: Array<{ name?: string }>;
  };
  return result.tools?.flatMap((tool) => (tool.name ? [tool.name] : [])) ?? [];
}

export async function describeRealPayboxTools(localUserId: string) {
  const client = await initializedClient(localUserId);
  const result = (await client.listTools()) as {
    tools?: Array<{
      name?: string;
      description?: string;
      inputSchema?: unknown;
    }>;
  };
  return (result.tools ?? []).flatMap((tool) =>
    tool.name
      ? [{
          name: tool.name,
          description: tool.description ?? "",
          inputSchema: tool.inputSchema ?? {},
        }]
      : [],
  );
}

export async function listRealPayboxWallets(
  localUserId: string,
  accessToken?: string,
): Promise<PayboxWallet[]> {
  const client = await initializedClient(localUserId, accessToken);
  const list = (await client.callTool("list_credentials")) as CredentialList;
  const credentials = (list.credentials ?? []).filter(
    (credential) =>
      credential.kind === "wallet" &&
      credential.metadata?.address &&
      credential.metadata.chains?.includes("solana"),
  );

  return Promise.all(
    credentials.map(async (credential) => {
      const portfolio = (await client.callTool("get_portfolio", {
        address: credential.metadata!.address!,
      })) as Portfolio;
      const usdc = portfolio.items?.find(
        (item) =>
          item.tokenAddress === PURCHASE_CONFIG.sourceToken.mint ||
          item.symbol?.toUpperCase() === "USDC",
      );
      const sol = portfolio.items?.find(
        (item) => item.tokenAddress === "native" && item.symbol?.toUpperCase() === "SOL",
      );
      const cbbtc = portfolio.items?.find(
        (item) =>
          item.tokenAddress === PURCHASE_CONFIG.destinationToken.mint ||
          item.symbol?.toUpperCase() === "CBBTC",
      );
      return {
        id: credential.credential_id,
        name: credential.name ?? "Paybox Solana wallet",
        address: credential.metadata!.address!,
        granted: true,
        chains: ["solana:mainnet"],
        approvalMode:
          credential.approval_mode === "always_approve" ? "ALWAYS_APPROVE" : "AUTONOMOUS",
        usdcBalanceAtomic: usdc?.balance ?? "0",
        cbbtcBalanceAtomic: cbbtc?.balance ?? "0",
        solBalanceLamports: sol?.balance ?? "0",
      };
    }),
  );
}

export async function completeRealPayboxConnection(
  localUserId: string,
  accessToken: string,
) {
  const wallets = await listRealPayboxWallets(localUserId, accessToken);
  const user = await db.user.findUniqueOrThrow({ where: { localUserId } });
  await db.$transaction([
    db.payboxConnection.update({
      where: { userId: user.id },
      data: {
        status: ConnectionStatus.CONNECTED,
        externalUserId: "paybox-oauth",
        connectedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    }),
    db.automation.update({
      where: { userId: user.id },
      data: { status: AutomationStatus.SETUP_REQUIRED },
    }),
  ]);
  return wallets;
}

export async function selectRealPayboxWallet(
  localUserId: string,
  credentialId: string,
) {
  const wallets = await listRealPayboxWallets(localUserId);
  const wallet = wallets.find((item) => item.id === credentialId);
  if (!wallet) throw new Error("Granted Solana wallet was not found in Paybox.");
  const user = await db.user.findUniqueOrThrow({ where: { localUserId } });
  await db.$transaction([
    db.payboxConnection.update({
      where: { userId: user.id },
      data: {
        selectedCredentialId: wallet.id,
        selectedWalletAddress: wallet.address,
        selectedWalletName: wallet.name,
        selectedWalletChains: wallet.chains,
        approvalMode:
          wallet.approvalMode === "AUTONOMOUS" ? ApprovalMode.AUTONOMOUS : ApprovalMode.ALWAYS_APPROVE,
        usdcBalanceAtomic: BigInt(wallet.usdcBalanceAtomic),
        cbbtcBalanceAtomic: BigInt(wallet.cbbtcBalanceAtomic),
        solBalanceLamports: BigInt(wallet.solBalanceLamports),
        lastSyncedAt: new Date(),
      },
    }),
    db.automation.update({
      where: { userId: user.id },
      data: { status: AutomationStatus.TEST_REQUIRED },
    }),
  ]);
}

export async function requestRealPayboxSwap(
  localUserId: string,
  input: SwapRequest,
): Promise<PayboxExecutionRequest> {
  const client = await initializedClient(localUserId);
  const result = (await client.callToolRaw("request_swap", {
    credential_id: input.credentialId,
    src_chain: input.chain,
    src_token: input.sourceMint,
    dst_token: input.destinationMint,
    amount: input.amountAtomic,
    swap_direction: "exact-amount-in",
    slippage_bps: input.slippageBps,
    value_cents: 100,
  })) as ToolResult;
  return normalizeRequest(result);
}

export async function getRealPayboxRequest(
  localUserId: string,
  requestId: string,
): Promise<PayboxExecutionRequest> {
  const client = await initializedClient(localUserId);
  const result = (await client.callToolRaw("get_request", {
    request_id: requestId,
  })) as ToolResult;
  return normalizeRequest(result);
}

export async function getPayboxSigningResource(localUserId: string) {
  const client = await initializedClient(localUserId);
  return client.readResource(WALLET_SIGN_RESOURCE);
}

const APP_TOOL_NAMES = new Set([
  "get_request",
  "moonx_resolve_binding",
  "moonx_sign",
  "submit_envelopes",
  "submit_signature",
]);

export async function callPayboxSigningTool(
  localUserId: string,
  name: string,
  args: Record<string, unknown>,
) {
  if (!APP_TOOL_NAMES.has(name)) throw new Error("This Paybox app tool is not allowed.");
  const client = await initializedClient(localUserId);
  return client.callToolRaw(name, args);
}

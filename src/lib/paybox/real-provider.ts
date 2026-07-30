import { ApprovalMode, AutomationStatus, ConnectionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { LOCAL_USER_ID, PURCHASE_CONFIG } from "@/lib/constants";
import { PayboxMcpClient } from "@/lib/paybox/mcp-client";
import { getPayboxAccessToken } from "@/lib/paybox/oauth";
import type { PayboxWallet } from "@/lib/paybox/provider";

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

async function initializedClient(accessToken?: string) {
  const client = new PayboxMcpClient(accessToken ?? (await getPayboxAccessToken()));
  await client.initialize();
  return client;
}

export async function inspectRealPayboxTools(accessToken: string) {
  const client = await initializedClient(accessToken);
  const result = (await client.listTools()) as {
    tools?: Array<{ name?: string }>;
  };
  return result.tools?.flatMap((tool) => (tool.name ? [tool.name] : [])) ?? [];
}

export async function listRealPayboxWallets(accessToken?: string): Promise<PayboxWallet[]> {
  const client = await initializedClient(accessToken);
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
      return {
        id: credential.credential_id,
        name: credential.name ?? "Paybox Solana wallet",
        address: credential.metadata!.address!,
        granted: true,
        chains: ["solana:mainnet"],
        approvalMode:
          credential.approval_mode === "always_approve" ? "ALWAYS_APPROVE" : "AUTONOMOUS",
        usdcBalanceAtomic: usdc?.balance ?? "0",
        solBalanceLamports: sol?.balance ?? "0",
      };
    }),
  );
}

export async function completeRealPayboxConnection(accessToken: string) {
  const wallets = await listRealPayboxWallets(accessToken);
  const user = await db.user.findUniqueOrThrow({ where: { localUserId: LOCAL_USER_ID } });
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

export async function selectRealPayboxWallet(credentialId: string) {
  const wallets = await listRealPayboxWallets();
  const wallet = wallets.find((item) => item.id === credentialId);
  if (!wallet) throw new Error("Granted Solana wallet was not found in Paybox.");
  const user = await db.user.findUniqueOrThrow({ where: { localUserId: LOCAL_USER_ID } });
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

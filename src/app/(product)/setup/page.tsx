"use client";

import { Check, CircleDollarSign, Fuel, Wallet } from "lucide-react";
import Link from "next/link";
import { WithState } from "@/components/page-state";
import { Address, Badge, Button, Card } from "@/components/ui";

export default function SetupPage() {
  return (
    <WithState>
      {(state, action) => {
        const selected = state.connection?.selectedCredentialId;
        const latestTest = state.executions.find(
          (execution) => execution.type === "TEST_PURCHASE",
        );
        const blockedTest =
          latestTest?.status === "BLOCKED_BY_POLICY" ||
          latestTest?.status === "FAILED";
        return (
          <div className="page">
            <div className="page-heading split">
              <div>
                <p className="eyebrow">Setup · Step 2 of 2</p>
                <h1>Select a Solana wallet</h1>
                <p>Only the selected granted wallet can be used for this fixed purchase.</p>
              </div>
              <Badge status={selected ? "READY" : "SETUP REQUIRED"} />
            </div>
            <div className="wallet-grid">
              {state.wallets.map((wallet) => (
                <Card className={`wallet-card ${selected === wallet.id ? "selected" : ""}`} key={wallet.id}>
                  <div className="wallet-card-head">
                    <div className="wallet-icon"><Wallet size={20} /></div>
                    <Badge status={wallet.granted ? "GRANTED" : "NOT GRANTED"} />
                  </div>
                  <h2>{wallet.name}</h2>
                  <Address>{wallet.address}</Address>
                  <div className="wallet-balances">
                    <span><CircleDollarSign size={16} /><b>{Number(wallet.usdcBalanceAtomic) / 1e6}</b> USDC</span>
                    <span><Fuel size={16} /><b>{Number(wallet.solBalanceLamports) / 1e9}</b> SOL</span>
                  </div>
                  <p className="wallet-network">
                    Solana mainnet · {wallet.approvalMode.replaceAll("_", " ").toLowerCase()}
                  </p>
                  <Button
                    variant={selected === wallet.id ? "secondary" : "primary"}
                    disabled={!wallet.granted || selected === wallet.id || action.isPending}
                    onClick={() => action.mutate({ action: "select-wallet", credentialId: wallet.id })}
                  >
                    {selected === wallet.id ? <><Check size={16} /> Selected</> : "Select wallet"}
                  </Button>
                </Card>
              ))}
            </div>
            <Card className="fixed-action">
              <div>
                <p className="eyebrow">Fixed automation</p>
                <h2>Every five minutes</h2>
              </div>
              <div className="fixed-swap"><strong>1 USDC</strong><span>→</span><strong>cbBTC</strong></div>
              <div className="fixed-details">
                <span>Solana mainnet</span><span>Max $12 / rolling 24h</span><span>Expires in 24h</span>
              </div>
              {selected && state.automation?.status === "TEST_REQUIRED" && (
                <Button
                  onClick={() => action.mutate({ action: "run-test" })}
                  disabled={action.isPending}
                >
                  {action.isPending ? "Running test…" : "Run $1 test purchase"}
                </Button>
              )}
              {blockedTest && (
                <div className="note-box danger">
                  <strong>Test purchase did not run</strong>
                  <p>
                    {latestTest.errorMessage ??
                      "The request was blocked before any funds were moved."}
                  </p>
                </div>
              )}
              {state.executions[0]?.status === "PENDING_USER_APPROVAL" && (
                <Link className="button button-primary" href="/dashboard">Approve test purchase</Link>
              )}
            </Card>
          </div>
        );
      }}
    </WithState>
  );
}

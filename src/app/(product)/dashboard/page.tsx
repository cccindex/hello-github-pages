"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  Check,
  Clock3,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import { WithState } from "@/components/page-state";
import { Address, Badge, Button, Card, Metric } from "@/components/ui";

function formatCountdown(date: string | null) {
  if (!date) return "Not scheduled";
  const milliseconds = new Date(date).getTime() - Date.now();
  if (milliseconds <= 0) return "Due now";
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export default function DashboardPage() {
  const [, setTick] = useState(0);
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <WithState>
      {(state, action) => {
        const automation = state.automation!;
        const connection = state.connection!;
        const pendingTest = state.executions.find(
          (item) => item.type === "TEST_PURCHASE" && item.status === "PENDING_USER_APPROVAL",
        );
        const testSuccess = state.executions.find(
          (item) => item.type === "TEST_PURCHASE" && item.status === "SUCCESS",
        );
        const active = automation.status === "ACTIVE";
        return (
          <div className="page">
            <div className="page-heading split">
              <div>
                <p className="eyebrow">Hosted control room</p>
                <h1>Your automation</h1>
                <p>One wallet. One fixed swap. Every event recorded.</p>
              </div>
              <Badge status={automation.status} />
            </div>

            {pendingTest && (
              <Card className="approval-card">
                <div className="approval-icon"><ShieldCheck size={24} /></div>
                <div>
                  <p className="eyebrow">Approval required</p>
                  <h2>Approve the $1 test purchase</h2>
                  <p>
                    This mock request will spend exactly 1 USDC from{" "}
                    <Address>{connection.selectedWalletAddress}</Address> and receive cbBTC.
                  </p>
                  <div className="progress-steps">
                    {["Wallet checked", "Swap requested", "Your approval", "Solana confirmation"].map(
                      (step, index) => <span className={index < 2 ? "done" : index === 2 ? "current" : ""} key={step}>{index < 2 ? <Check size={13} /> : index + 1} {step}</span>,
                    )}
                  </div>
                  <Button
                    onClick={() => action.mutate({ action: "approve-test", executionId: pendingTest.id })}
                    disabled={action.isPending}
                  >
                    Approve exactly 1 USDC
                  </Button>
                </div>
              </Card>
            )}

            {automation.status === "READY" && testSuccess && (
              <Card className="activation-card">
                <div>
                  <p className="eyebrow">Test succeeded</p>
                  <h2>Activate recurring purchases?</h2>
                  <p>
                    Maximum $1 per purchase, 12 per rolling hour, $12 per rolling
                    24 hours, $25 total, and automatic expiry after 24 hours.
                  </p>
                </div>
                <label>
                  Type <b>ACTIVATE</b>
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="ACTIVATE"
                  />
                </label>
                <Button
                  disabled={confirmation !== "ACTIVATE" || action.isPending}
                  onClick={() => action.mutate({ action: "activate", confirmation })}
                >
                  Activate automation
                </Button>
              </Card>
            )}

            <Card className="automation-card">
              <div className="automation-head">
                <div>
                  <span className="muted">Five-Minute Bitcoin Buy</span>
                  <h2>1 USDC <span>→</span> cbBTC</h2>
                </div>
                <Badge status={automation.status} />
              </div>
              <div className="automation-meta">
                <div><span>Schedule</span><b>Every 5 minutes</b></div>
                <div><span>Network</span><b>Solana mainnet</b></div>
                <div><span>Wallet</span><b>{connection.selectedWalletName ?? "Not selected"}</b><Address>{connection.selectedWalletAddress}</Address></div>
              </div>
              <div className="metric-grid">
                <Metric label="Next purchase" value={formatCountdown(automation.nextRunAt)} detail="UTC schedule" />
                <Metric label="Spent · rolling 24h" value={`$${(state.metrics.spendTodayCents / 100).toFixed(0)} of $12`} />
                <Metric label="Lifetime spend" value={`$${(state.metrics.lifetimeSpendCents / 100).toFixed(0)} of $25`} />
                <Metric label="Automation expires" value={formatCountdown(automation.expiresAt)} />
              </div>
              <div className="control-row">
                {active ? (
                  <Button variant="secondary" onClick={() => action.mutate({ action: "pause" })}><Pause size={16} /> Pause</Button>
                ) : automation.status === "PAUSED" ? (
                  <Button onClick={() => action.mutate({ action: "resume" })}><Play size={16} /> Resume</Button>
                ) : null}
                <Button
                  variant="secondary"
                  disabled={!active || action.isPending}
                  onClick={() => action.mutate({ action: "run-now" })}
                >
                  <Play size={16} /> Run one now
                </Button>
                <Button
                  variant="quiet"
                  disabled={!active || action.isPending}
                  onClick={() => action.mutate({ action: "run-scheduler" })}
                >
                  <Clock3 size={16} /> Trigger scheduler
                </Button>
                <Button variant="danger" onClick={() => action.mutate({ action: "pause" })}>
                  <AlertOctagon size={16} /> Stop all purchases
                </Button>
              </div>
            </Card>

            <div className="balance-grid">
              <Metric label="USDC balance" value={`${(Number(connection.usdcBalanceAtomic) / 1e6).toFixed(2)} USDC`} detail="Source balance" />
              <Metric label="cbBTC balance" value={`${(Number(connection.cbbtcBalanceAtomic) / 1e8).toFixed(8)} cbBTC`} detail="Wrapped Bitcoin on Solana" />
              <Metric label="SOL fee balance" value={`${(Number(connection.solBalanceLamports) / 1e9).toFixed(4)} SOL`} detail="Estimated sufficient" />
            </div>

            {state.executions[0] && (
              <Card className="latest-card">
                <div className="section-head"><div><p className="eyebrow">Latest execution</p><h2>{state.executions[0].type.replaceAll("_", " ")}</h2></div><Badge status={state.executions[0].status} /></div>
                <div className="latest-row">
                  <span>{new Date(state.executions[0].createdAt).toLocaleString()}</span>
                  <span>1.00 USDC</span>
                  <Address>{state.executions[0].providerRequestId}</Address>
                  <Link href="/activity">View activity →</Link>
                </div>
              </Card>
            )}
          </div>
        );
      }}
    </WithState>
  );
}

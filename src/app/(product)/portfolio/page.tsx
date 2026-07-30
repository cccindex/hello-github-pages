"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { WithState } from "@/components/page-state";
import { Address, Badge, Card, Button } from "@/components/ui";
import type { ProductState } from "@/lib/client-state";

type PortfolioData = {
  asOf: string;
  wallet: { name: string | null; address: string; credentialId: string };
  assets: Array<{
    symbol: string;
    name: string;
    tokenAddress: string;
    amount: number;
    rawBalance: string;
    decimals: number | null;
    priceUsd: number | null;
    valueUsd: number | null;
    logo: string | null;
  }>;
  providerRequests: Array<{
    id: string;
    status: string;
    tool: string;
    createdAt: string | null;
    transactionSignature: string | null;
    amount: string | null;
  }>;
  worldPositions: Array<{
    id: string;
    market: string;
    outcome: string;
    quantity: number;
    valueUsd: number | null;
  }>;
  errors: Record<string, string | null>;
};

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function amount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 0.01 ? 8 : 4,
  }).format(value);
}

function agentAction(execution: ProductState["executions"][number]) {
  const plan = execution.policyDecisionJson.plan;
  if (!plan) return execution.type.replaceAll("_", " ");
  if (plan.type === "swap") return `Swap ${plan.amount} ${plan.sourceSymbol} → ${plan.destinationSymbol}`;
  if (plan.type === "transfer") return `Transfer ${plan.amount} ${plan.tokenSymbol}`;
  return `Buy ${plan.outcome} · ${plan.marketTitle}`;
}

function explorerUrl(signature: string) {
  return `https://solscan.io/tx/${encodeURIComponent(signature)}`;
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/portfolio", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load portfolio.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load portfolio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const knownValue = useMemo(
    () => data?.assets.reduce((sum, asset) => sum + (asset.valueUsd ?? 0), 0) ?? 0,
    [data],
  );
  const pricedAssets = data?.assets.filter((asset) => asset.valueUsd !== null) ?? [];
  const unpricedAssets = (data?.assets.length ?? 0) - pricedAssets.length;

  return (
    <WithState>
      {(state) => (
        <div className="page portfolio-page">
          <div className="page-heading split portfolio-heading">
            <div>
              <p className="eyebrow">Live Paybox account</p>
              <h1>Agent portfolio</h1>
              <p>Every balance, World position, and transaction your agent has created.</p>
            </div>
            <Button variant="secondary" onClick={refresh} disabled={loading}>
              <RefreshCw className={loading ? "spin" : ""} size={15} />
              Refresh Paybox
            </Button>
          </div>

          {error && <div className="note-box danger"><strong>Portfolio unavailable</strong><p>{error}</p></div>}
          {loading && !data && <div className="portfolio-loading"><Loader2 className="spin" /> Reading your live Paybox account…</div>}

          {data && (
            <>
              {Object.values(data.errors).some(Boolean) && (
                <div className="portfolio-source-note">
                  Some Paybox sources are temporarily unavailable:{" "}
                  {Object.entries(data.errors)
                    .filter(([, message]) => Boolean(message))
                    .map(([source]) => source)
                    .join(", ")}. Available account data is still shown below.
                </div>
              )}
              <section className="portfolio-overview">
                <Card className="portfolio-total">
                  <div className="portfolio-total-head">
                    <span><CircleDollarSign size={17} /> KNOWN PORTFOLIO VALUE</span>
                    <Badge status="LIVE" />
                  </div>
                  <strong>{money(knownValue)}</strong>
                  <p>
                    {data.assets.length} assets · {unpricedAssets
                      ? `${unpricedAssets} without a USD quote`
                      : "all assets priced"}
                  </p>
                  <div className="allocation-bar">
                    {pricedAssets.map((asset) => (
                      <i
                        key={asset.tokenAddress}
                        title={`${asset.symbol} ${money(asset.valueUsd)}`}
                        style={{ width: `${knownValue ? ((asset.valueUsd ?? 0) / knownValue) * 100 : 0}%` }}
                      />
                    ))}
                  </div>
                </Card>
                <Card className="portfolio-wallet-card">
                  <span><WalletCards size={16} /> AGENT WALLET</span>
                  <strong>{data.wallet.name ?? "Paybox wallet"}</strong>
                  <Address>{data.wallet.address}</Address>
                  <small>Updated {new Date(data.asOf).toLocaleString()}</small>
                </Card>
                <Card className="portfolio-stat-card">
                  <span><BriefcaseBusiness size={16} /> AGENT ACTIVITY</span>
                  <strong>{state.executions.length}</strong>
                  <p>{state.metrics.successfulPurchases} successful · {data.providerRequests.length} Paybox requests</p>
                </Card>
              </section>

              <div className="portfolio-section-head">
                <div><p className="eyebrow">Live holdings</p><h2>All balances</h2></div>
                <span>{data.assets.length} assets</span>
              </div>
              <Card className="holdings-card">
                <div className="holding-row holding-head">
                  <span>Asset</span><span>Balance</span><span>Price</span><span>Value</span><span>Allocation</span>
                </div>
                {data.assets.length === 0 && <div className="empty-row">Paybox returned no non-zero token balances.</div>}
                {data.assets.map((asset, index) => {
                  const allocation = asset.valueUsd !== null && knownValue
                    ? (asset.valueUsd / knownValue) * 100
                    : null;
                  return (
                    <div className="holding-row" key={`${asset.tokenAddress}:${index}`}>
                      <span className="holding-asset">
                        <b>{asset.symbol.slice(0, 2)}</b>
                        <i><strong>{asset.symbol}</strong><small>{asset.name}</small></i>
                      </span>
                      <span><strong>{amount(asset.amount)}</strong><small>{asset.symbol}</small></span>
                      <span>{money(asset.priceUsd)}</span>
                      <span><strong>{money(asset.valueUsd)}</strong></span>
                      <span className="holding-allocation">
                        <i><b style={{ width: `${allocation ?? 0}%` }} /></i>
                        {allocation === null ? "—" : `${allocation.toFixed(1)}%`}
                      </span>
                    </div>
                  );
                })}
              </Card>

              <div className="portfolio-section-head">
                <div><p className="eyebrow">Prediction exposure</p><h2>World positions</h2></div>
                <span>{data.worldPositions.length} open</span>
              </div>
              <section className="position-grid">
                {data.worldPositions.length === 0 && (
                  <Card className="empty-position">
                    {data.errors.positions
                      ? "Paybox did not expose World positions for this wallet."
                      : "No open World positions found."}
                  </Card>
                )}
                {data.worldPositions.map((position) => (
                  <Card className="position-card" key={position.id}>
                    <span>WORLD · {position.outcome.toUpperCase()}</span>
                    <h3>{position.market}</h3>
                    <div><strong>{amount(position.quantity)}</strong><small>contracts</small><b>{money(position.valueUsd)}</b></div>
                  </Card>
                ))}
              </section>

              <div className="portfolio-section-head">
                <div><p className="eyebrow">Persistent agent ledger</p><h2>All agent transactions</h2></div>
                <span>{state.executions.length} recorded</span>
              </div>
              <Card className="portfolio-ledger">
                <div className="portfolio-tx portfolio-tx-head">
                  <span>Action</span><span>Created</span><span>Value</span><span>Status</span><span>Transaction</span><span />
                </div>
                {state.executions.length === 0 && <div className="empty-row">The agent has not created a transaction yet.</div>}
                {state.executions.map((execution) => (
                  <div className="portfolio-tx-wrap" key={execution.id}>
                    <button className="portfolio-tx" onClick={() => setOpenId(openId === execution.id ? null : execution.id)}>
                      <span className="tx-action">
                        <i className={execution.status === "SUCCESS" ? "success" : ""}>
                          {execution.policyDecisionJson.plan?.type === "transfer"
                            ? <ArrowUpRight size={15} />
                            : <ArrowDownLeft size={15} />}
                        </i>
                        <b>{agentAction(execution)}</b>
                      </span>
                      <span>{new Date(execution.createdAt).toLocaleString()}</span>
                      <span>{money(execution.displayAmountCents / 100)}</span>
                      <span><Badge status={execution.status} /></span>
                      <span>
                        {execution.transactionSignature
                          ? <a href={explorerUrl(execution.transactionSignature)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Solscan <ExternalLink size={11} /></a>
                          : <Address>{execution.providerRequestId}</Address>}
                      </span>
                      <ChevronDown className={openId === execution.id ? "rotate" : ""} size={15} />
                    </button>
                    {openId === execution.id && (
                      <div className="portfolio-tx-detail">
                        <div><span>Agent execution ID</span><code>{execution.id}</code></div>
                        <div><span>Paybox request</span><code>{execution.providerRequestId ?? "Not created"}</code></div>
                        <div><span>Idempotency key</span><code>{execution.idempotencyKey}</code></div>
                        <div><span>Completed</span><b>{execution.completedAt ? new Date(execution.completedAt).toLocaleString() : "Pending"}</b></div>
                        {execution.errorMessage && <p>{execution.errorMessage}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </Card>

              {data.providerRequests.length > 0 && (
                <>
                  <div className="portfolio-section-head secondary-ledger-head">
                    <div><p className="eyebrow">Direct from Paybox</p><h2>Paybox request history</h2></div>
                    <span>{data.providerRequests.length} requests</span>
                  </div>
                  <Card className="provider-request-grid">
                    {data.providerRequests.map((item) => (
                      <div key={item.id}>
                        <span><strong>{item.tool.replaceAll("_", " ")}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Time unavailable"}</small></span>
                        <Badge status={item.status} />
                        <Address>{item.transactionSignature ?? item.id}</Address>
                      </div>
                    ))}
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      )}
    </WithState>
  );
}

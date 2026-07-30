"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { TransactionPlan } from "@/lib/action-plan";
import {
  useProductAction,
  useProductState,
  type ProductState,
} from "@/lib/client-state";
import { PayboxSigningApp } from "@/components/paybox-signing-app";

type Stock = {
  symbol: string;
  underlyingSymbol: string;
  name: string;
  logo: string;
  mint: string;
  decimals: number;
  halted: boolean;
  atomicSwaps: boolean;
  referencePrice: number | null;
  onchainPrice: number | null;
  premiumPct: number | null;
  change24hPct: number | null;
  liquidityUsd: number;
  volume24hUsd: number;
  dexUrl: string | null;
  score: number;
};

type StockFeed = {
  asOf: string;
  methodology: string;
  stocks: Stock[];
  error?: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
  plan?: TransactionPlan | null;
  meta?: string;
};

const NAV = [
  { href: "/trade", label: "AI transact" },
  { href: "/intel", label: "Stock feed" },
  { href: "/predictions", label: "World markets" },
  { href: "/portfolio", label: "Portfolio" },
];

function money(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(value);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function RoomShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  const { data } = useProductState();
  const connected = data?.connection?.status === "CONNECTED";
  const balance = data?.connection
    ? `${(Number(data.connection.usdcBalanceAtomic) / 1e6).toFixed(2)} USDC`
    : "Wallet offline";
  return (
    <main className="live-room">
      <header className="live-room-nav">
        <Link href="/" className="experience-brand">
          <span className="experience-brand-mark"><Sparkles size={16} /></span>
          <span>Paybox Rooms</span>
        </Link>
        <nav>
          {NAV.map((item) => (
            <Link className={active === item.href ? "active" : ""} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href={connected ? "/portfolio" : "/api/paybox/connect?returnTo=/trade"} className="live-wallet">
          <i className={connected ? "connected" : ""} />
          {connected ? balance : "Connect Paybox"}
        </Link>
      </header>
      {children}
    </main>
  );
}

function ConnectionGate({ state }: { state: ProductState }) {
  const action = useProductAction();
  const connected = state.connection?.status === "CONNECTED";
  const selected = state.connection?.selectedCredentialId;
  if (connected && selected) return null;
  return (
    <section className="connection-gate">
      <div><WalletCards size={22} /></div>
      <span>PAYBOX SETUP</span>
      {!connected ? (
        <>
          <h2>Connect the wallet the agent is allowed to use.</h2>
          <p>No site password. Paybox handles the grant and client-side signing.</p>
          <a href="/api/paybox/connect?returnTo=/trade">
            Connect Paybox <ArrowRight size={15} />
          </a>
        </>
      ) : (
        <>
          <h2>Choose the granted Solana wallet.</h2>
          <p>The agent never receives the signing key.</p>
          <div className="wallet-choice-list">
            {state.wallets.map((wallet) => (
              <button
                disabled={action.isPending}
                key={wallet.id}
                onClick={() =>
                  action.mutate({ action: "select-wallet", credentialId: wallet.id })
                }
              >
                <span>{wallet.name}<small>{wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}</small></span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function planSummary(plan: TransactionPlan) {
  if (plan.type === "swap") {
    return {
      verb: "SWAP",
      left: `${plan.amount} ${plan.sourceSymbol}`,
      right: plan.destinationSymbol,
      detail: `${(plan.slippageBps / 100).toFixed(2)}% maximum slippage`,
    };
  }
  if (plan.type === "transfer") {
    return {
      verb: "TRANSFER",
      left: `${plan.amount} ${plan.tokenSymbol}`,
      right: `${plan.recipient.slice(0, 8)}…${plan.recipient.slice(-6)}`,
      detail: "Solana mainnet transfer",
    };
  }
  return {
    verb: `BUY ${plan.outcome}`,
    left: `${plan.amountUsdc} USDC`,
    right: plan.marketTitle,
    detail: `${(plan.slippageBps / 100).toFixed(2)}% maximum slippage`,
  };
}

function TransactionReview({
  plan,
  onClose,
}: {
  plan: TransactionPlan;
  onClose: () => void;
}) {
  const { data } = useProductState();
  const action = useProductAction();
  const [execution, setExecution] =
    useState<ProductState["executions"][number] | null>(null);
  const [error, setError] = useState("");
  const summary = planSummary(plan);

  const execute = async () => {
    setError("");
    try {
      const next = await action.mutateAsync({ action: "execute-plan", plan });
      setExecution(next.executions[0] ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The transaction was not created.");
    }
  };
  const refresh = async () => {
    if (!execution) return;
    try {
      const next = await action.mutateAsync({
        action: "refresh-execution",
        executionId: execution.id,
      });
      setExecution(next.executions.find((item) => item.id === execution.id) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh Paybox.");
    }
  };

  return (
      <section className="inline-transaction-review">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="eyebrow">REAL PAYBOX TRANSACTION</span>
        <h2>{plan.title}</h2>
        <p className="plan-rationale">{plan.rationale}</p>
        <div className="transaction-flow">
          <div><span>{summary.verb}</span><strong>{summary.left}</strong></div>
          <ArrowRight size={20} />
          <div><span>TO</span><strong>{summary.right}</strong></div>
        </div>
        <div className="transaction-details">
          <span><b>Network</b>Solana mainnet</span>
          <span><b>Estimated value</b>{money(plan.valueCents / 100)}</span>
          <span><b>Policy</b>{summary.detail}</span>
          <span><b>Wallet</b>{data?.connection?.selectedWalletName ?? "Not selected"}</span>
        </div>
        {!execution && (
          <button className="execute-button" disabled={action.isPending} onClick={execute}>
            {action.isPending ? <><Loader2 className="spin" size={16} /> Creating Paybox request…</> : "Confirm exact transaction"}
          </button>
        )}
        {error && <p className="transaction-error">{error}</p>}
        {execution && (
          <div className="execution-status-card">
            <span>PAYBOX REQUEST</span>
            <strong>{execution.status.replaceAll("_", " ")}</strong>
            <small>{execution.providerRequestId ?? execution.id}</small>
            {execution.status === "SUCCESS" ? (
              <p><CheckCircle2 size={15} /> Confirmed successfully.</p>
            ) : (
              <button disabled={action.isPending} onClick={refresh}>
                <RefreshCw size={14} /> Check status
              </button>
            )}
          </div>
        )}
        {execution &&
          data?.mode === "real" &&
          data.connection?.selectedCredentialId &&
          ["PENDING_SIGNATURE", "PENDING_USER_APPROVAL", "PENDING_CONFIRMATION", "PENDING_SETTLEMENT"].includes(execution.status) && (
            <PayboxSigningApp
              executionId={execution.id}
              credentialId={data.connection.selectedCredentialId}
              toolResult={execution.providerResponseJson ?? {}}
              actionInput={execution.policyDecisionJson.toolInput}
              onRequestChanged={refresh}
            />
          )}
      </section>
  );
}

async function loadStocks() {
  const response = await fetch("/api/markets/stocks", { cache: "no-store" });
  const body = (await response.json()) as StockFeed;
  if (!response.ok) throw new Error(body.error ?? "Could not load the stock feed.");
  return body;
}

export function TradeRoom() {
  const { data } = useProductState();
  const [feed, setFeed] = useState<StockFeed | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Tell me the exact transaction you want. I can compose verified Solana swaps—including xStocks—and token transfers, then show the full Paybox request before anything is signed.",
      meta: "Live AI · no transaction runs without confirmation",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [review, setReview] = useState<TransactionPlan | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStocks().then(setFeed).catch(() => undefined);
    const prompt = new URLSearchParams(window.location.search).get("prompt");
    if (prompt) {
      setInput(prompt);
      window.history.replaceState({}, "", "/trade");
    }
  }, []);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, review, thinking]);

  const ask = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || thinking || !data) return;
    const nextMessages = [...messages, { role: "user" as const, content: prompt }];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    try {
      const marketContext = feed?.stocks
        .map(
          (stock) =>
            `${stock.symbol}: issuer ${stock.referencePrice}, onchain ${stock.onchainPrice}, 24h ${stock.change24hPct}%, liquidity ${stock.liquidityUsd}`,
        )
        .join("\n");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "trade",
          context: {
            payboxConnected: data.connection?.status === "CONNECTED",
            walletSelected: Boolean(data.connection?.selectedCredentialId),
            realFinancialExecutionEnabled: data.realFinancialExecutionEnabled,
            marketContext,
          },
          messages: nextMessages.slice(-18).map(({ role, content }) => ({ role, content })),
        }),
      });
      const body = (await response.json()) as {
        message?: string;
        plan?: TransactionPlan | null;
        model?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "AI request failed.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: body.message ?? "I could not formulate a transaction.",
          plan: body.plan,
          meta: `OpenRouter · ${body.model ?? "live model"}`,
        },
      ]);
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: caught instanceof Error ? caught.message : "The AI request failed.",
          meta: "Nothing executed",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };
  const recent = data?.executions.filter((item) => item.type === "MANUAL_PURCHASE").slice(0, 4) ?? [];

  return (
    <RoomShell active="/trade">
      <section className="trade-room-grid">
        <section className="trade-context">
          <span className="eyebrow"><Radio size={13} /> LIVE TRANSACTION DESK</span>
          <h1>Say what you want.<br />Review what gets signed.</h1>
          <p>
            Milo resolves verified asset contracts, atomic units and the correct Paybox operation.
            The wallet still signs client-side.
          </p>
          {data && <ConnectionGate state={data} />}
          <div className="capability-list">
            <article><strong>Swap</strong><span>USDC, SOL, cbBTC and live Solana xStocks</span></article>
            <article><strong>Transfer</strong><span>Send a verified token to a Solana address</span></article>
            <article><strong>World</strong><span>Trade live prediction outcomes from the World room</span></article>
          </div>
          {recent.length > 0 && (
            <div className="recent-ledger">
              <span>RECENT PAYBOX REQUESTS</span>
              {recent.map((item) => (
                <div key={item.id}>
                  <strong>{item.policyDecisionJson.plan?.title ?? "Paybox transaction"}</strong>
                  <small>{item.status.replaceAll("_", " ")} · {money(item.displayAmountCents / 100)}</small>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="transaction-chat">
          <header>
            <div><Bot size={18} /></div>
            <span><strong>Milo</strong><small><i /> Paybox transaction agent</small></span>
            <b>LIVE AI</b>
          </header>
          <div className="transaction-messages" ref={messagesRef}>
            {messages.map((message, index) => (
              <article className={message.role} key={index}>
                <p>{message.content}</p>
                {message.meta && <small>{message.meta}</small>}
                {message.plan && (
                  <button className="inline-plan" onClick={() => setReview(message.plan ?? null)}>
                    <span><ShieldCheck size={15} /> Transaction ready</span>
                    <strong>{planSummary(message.plan).left} → {planSummary(message.plan).right}</strong>
                    <em>Review and confirm <ArrowRight size={14} /></em>
                  </button>
                )}
              </article>
            ))}
            {messages.length === 1 && (
              <div className="chat-prompts">
                {[
                  "Swap 1 USDC to AAPLx",
                  "Swap 2 USDC to SOL",
                  "Sell 0.001 AAPLx to USDC",
                  "What xStock has the strongest live setup?",
                ].map((prompt) => <button onClick={() => ask(prompt)} key={prompt}>{prompt}</button>)}
              </div>
            )}
            {review && (
              <TransactionReview
                key={review.title}
                plan={review}
                onClose={() => setReview(null)}
              />
            )}
            {thinking && <div className="thinking"><i /><i /><i /></div>}
          </div>
          <form onSubmit={submit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask(input);
                }
              }}
              placeholder="Example: Swap 1 USDC to NVDAx…"
              rows={2}
            />
            <button disabled={!input.trim() || thinking}><Send size={17} /></button>
          </form>
        </section>
      </section>
    </RoomShell>
  );
}

export function StocksRoom() {
  const [feed, setFeed] = useState<StockFeed | null>(null);
  const [error, setError] = useState("");
  const refresh = () => {
    setError("");
    loadStocks().then(setFeed).catch((caught) => setError(caught.message));
  };
  useEffect(refresh, []);
  return (
    <RoomShell active="/intel">
      <section className="feed-page">
        <header className="feed-hero">
          <div>
            <span className="eyebrow"><Radio size={13} /> RSA LIVE FEED · SOLANA xSTOCKS</span>
            <h1>The stock tape,<br />rebuilt for agents.</h1>
          </div>
          <div>
            <p>Live issuer reference prices meet Solana liquidity, volume and momentum. Every contract comes from the xStocks asset registry.</p>
            <button onClick={refresh}><RefreshCw size={14} /> Refresh feed</button>
          </div>
        </header>
        {error && <p className="feed-error">{error}</p>}
        {!feed ? (
          <div className="feed-loading"><Loader2 className="spin" /> Reading live Solana markets…</div>
        ) : (
          <>
            <div className="feed-method">
              <span>LAST UPDATE {new Date(feed.asOf).toLocaleTimeString()}</span>
              <p>{feed.methodology}</p>
            </div>
            <section className="stock-table">
              <header><span>RANK / ASSET</span><span>REFERENCE</span><span>ONCHAIN / GAP</span><span>24H</span><span>LIQUIDITY / VOLUME</span><span /></header>
              {feed.stocks.map((stock, index) => (
                <article key={stock.mint}>
                  <div className="stock-name">
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stock.logo} alt="" />
                    <span><strong>{stock.symbol}</strong><small>{stock.name}</small></span>
                  </div>
                  <strong>{money(stock.referencePrice)}</strong>
                  <span><strong>{money(stock.onchainPrice)}</strong><small className={(stock.premiumPct ?? 0) > 0 ? "up" : "down"}>{stock.premiumPct === null ? "No DEX quote" : `${stock.premiumPct > 0 ? "+" : ""}${stock.premiumPct.toFixed(2)}% gap`}</small></span>
                  <strong className={(stock.change24hPct ?? 0) >= 0 ? "up" : "down"}>{stock.change24hPct === null ? "—" : `${stock.change24hPct > 0 ? "+" : ""}${stock.change24hPct.toFixed(2)}%`}</strong>
                  <span><strong>{compactMoney(stock.liquidityUsd)}</strong><small>{compactMoney(stock.volume24hUsd)} vol</small></span>
                  <div className="stock-actions">
                    <Link href={`/trade?prompt=${encodeURIComponent(`Analyze the live setup and swap 1 USDC to ${stock.symbol}`)}`}>Ask + trade <ArrowRight size={13} /></Link>
                    {stock.dexUrl && <a href={stock.dexUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </section>
    </RoomShell>
  );
}

function deepFind(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) if (record[key] !== undefined) return record[key];
  for (const child of Object.values(record)) {
    const found = deepFind(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function PredictionsRoom() {
  const { data } = useProductState();
  const [payload, setPayload] = useState<{ asOf: string; markets: Array<Record<string, unknown>> } | null>(null);
  const [error, setError] = useState("");
  const [review, setReview] = useState<TransactionPlan | null>(null);
  const [worldInput, setWorldInput] = useState("");
  const [worldThinking, setWorldThinking] = useState(false);
  const worldMessagesRef = useRef<HTMLDivElement>(null);
  const [worldMessages, setWorldMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I’m grounded in the live World markets on this page. Ask me to compare probabilities, challenge a valuation, or prepare an exact YES/NO trade.",
      meta: "Oracle · live World context",
    },
  ]);
  useEffect(() => {
    const element = worldMessagesRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [worldMessages, review, worldThinking]);
  const refresh = async () => {
    setError("");
    try {
      const response = await fetch("/api/markets/predictions", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load World markets.");
      setPayload(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load World markets.");
    }
  };
  useEffect(() => { refresh(); }, []);
  const cards = useMemo(
    () =>
      (payload?.markets ?? []).map((market) => {
        const ticker = String(market.ticker ?? market.market_ticker ?? "");
        const title = String(market.title ?? market.question ?? market.subtitle ?? ticker);
        const orderbook = (market.orderbook ?? {}) as Record<string, unknown>;
        const yesBook = (orderbook.yes ?? {}) as Record<string, unknown>;
        const yesMint = String(
          orderbook.yesMint ??
          market.yes_mint ??
          market.yesMint ??
          deepFind(market, ["yes_mint", "yesMint", "yesMintAddress"]) ??
          "",
        );
        const noMint = String(
          orderbook.noMint ??
          market.no_mint ??
          market.noMint ??
          deepFind(market, ["no_mint", "noMint", "noMintAddress"]) ??
          "",
        );
        const bid = Number(yesBook.bid);
        const ask = Number(yesBook.ask);
        const yesPrice =
          Number.isFinite(bid) && Number.isFinite(ask)
            ? (bid + ask) / 2
            : Number.isFinite(ask)
              ? ask
              : Number.isFinite(bid)
                ? bid
                : null;
        const analysis = market.analysis as
          | { label?: string; reason?: string }
          | null
          | undefined;
        return {
          market,
          ticker,
          title,
          yesMint,
          noMint,
          yesPrice,
          analysis,
          trades24h: Number(market.trades24h ?? 0),
          volume24h: Number(market.volume24hFp ?? 0) / 1e6,
        };
      }),
    [payload],
  );

  const buildWorldPlan = (
    card: (typeof cards)[number],
    outcome: "YES" | "NO",
    amountUsdc = 1,
  ): TransactionPlan | null => {
    const mint = outcome === "YES" ? card.yesMint : card.noMint;
    if (!mint) {
      setError("Paybox did not return an outcome mint for this market.");
      return null;
    }
    const implied = card.yesPrice === null ? "The live order book is the source of truth." : `YES is currently near ${(card.yesPrice * (card.yesPrice <= 1 ? 100 : 1)).toFixed(1)}¢.`;
    return {
      type: "world_buy",
      title: `Buy ${outcome}: ${card.title}`,
      rationale: `${implied} This is a hypothesis from the live World market structure, not a guaranteed valuation.`,
      valueCents: Math.round(amountUsdc * 100),
      marketTicker: card.ticker,
      marketTitle: card.title,
      outcome,
      marketMint: mint,
      amountUsdc,
      slippageBps: 100,
    };
  };

  const trade = (card: (typeof cards)[number], outcome: "YES" | "NO") => {
    const plan = buildWorldPlan(card, outcome);
    if (!plan) return;
    setWorldMessages((current) => [
      ...current,
      { role: "user", content: `Prepare a $1 ${outcome} trade on ${card.title}.` },
      {
        role: "assistant",
        content: `I prepared the exact ${outcome} outcome purchase from the live World market. Review the price thesis and Paybox request below.`,
        meta: "World action ready",
        plan,
      },
    ]);
    setReview(plan);
  };

  const askWorld = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || worldThinking || !data || cards.length === 0) return;
    const nextMessages = [
      ...worldMessages,
      { role: "user" as const, content: prompt },
    ];
    setWorldMessages(nextMessages);
    setWorldInput("");
    setWorldThinking(true);
    try {
      const worldMarkets = cards.map((card) => ({
        ticker: card.ticker,
        title: card.title,
        yesMint: card.yesMint,
        noMint: card.noMint,
        yesPrice: card.yesPrice,
      }));
      const marketContext = cards
        .map(
          (card) =>
            `${card.ticker}: ${card.title}; YES=${card.yesPrice ?? "no quote"}; ${card.analysis?.label ?? "unrated"}; ${card.analysis?.reason ?? ""}`,
        )
        .join("\n");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "predictions",
          context: {
            payboxConnected: data.connection?.status === "CONNECTED",
            walletSelected: Boolean(data.connection?.selectedCredentialId),
            realFinancialExecutionEnabled: data.realFinancialExecutionEnabled,
            marketContext,
            worldMarkets,
          },
          messages: nextMessages.slice(-18).map(({ role, content }) => ({ role, content })),
        }),
      });
      const body = (await response.json()) as {
        message?: string;
        plan?: TransactionPlan | null;
        model?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "World AI request failed.");
      setWorldMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: body.message ?? "I could not complete that World analysis.",
          plan: body.plan,
          meta: `OpenRouter · ${body.model ?? "live model"}`,
        },
      ]);
    } catch (caught) {
      setWorldMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            caught instanceof Error ? caught.message : "The World AI request failed.",
          meta: "Nothing executed",
        },
      ]);
    } finally {
      setWorldThinking(false);
    }
  };

  return (
    <RoomShell active="/predictions">
      <section className="feed-page prediction-page">
        <header className="feed-hero">
          <div>
            <span className="eyebrow"><Radio size={13} /> WORLD · LIVE PREDICTION MARKETS</span>
            <h1>Trade probabilities,<br />not headlines.</h1>
          </div>
          <div>
            <p>Live World markets and order books read through your Paybox connection. Trade cards use the exact YES/NO outcome mint.</p>
            <button onClick={refresh}><RefreshCw size={14} /> Refresh markets</button>
          </div>
        </header>
        {data && <ConnectionGate state={data} />}
        {error && <p className="feed-error">{error}</p>}
        {!payload && !error && <div className="feed-loading"><Loader2 className="spin" /> Reading World order books…</div>}
        {payload && (
          <section className="prediction-room-grid">
            <div className="prediction-feed-column">
              <div className="feed-method">
                <span>LIVE THROUGH PAYBOX · {new Date(payload.asOf).toLocaleTimeString()}</span>
                <p>“Under/overvalued” is an agent screen based on the live spread and order-book balance; it is a thesis to investigate, not a fact.</p>
              </div>
              <section className="prediction-grid">
              {cards.map((card, index) => {
                const probability =
                  card.yesPrice === null
                    ? null
                    : card.yesPrice <= 1
                      ? card.yesPrice * 100
                      : card.yesPrice;
                const fallbackView =
                  probability === null
                    ? "No two-sided quote: price discovery is weak, so avoid treating the displayed market state as fair value."
                    : probability < 35
                      ? "Long-shot screen: YES is inexpensive, but only undervalued if your independent probability is materially higher after fees and spread."
                      : probability > 65
                        ? "Consensus screen: YES is expensive. The cleaner contrarian trade is NO only if evidence can beat the market’s high implied probability."
                    : "Balanced screen: neither side is obviously cheap. The opportunity depends on evidence the current order book has not incorporated.";
                const view = card.analysis?.reason ?? fallbackView;
                return (
                  <article key={card.ticker || index}>
                    <div className="prediction-card-head"><span>WORLD #{String(index + 1).padStart(2, "0")}</span><b>LIVE</b></div>
                    <h2>{card.title}</h2>
                    <div className="probability"><strong>{probability === null ? "—" : `${probability.toFixed(1)}%`}</strong><span>implied YES</span></div>
                    <b className="agent-valuation">{card.analysis?.label ?? "MARKET-STRUCTURE WATCH"}</b>
                    <p>{view}</p>
                    <div className="prediction-actions">
                      <button disabled={!card.yesMint} onClick={() => trade(card, "YES")}>Buy YES · $1</button>
                      <button disabled={!card.noMint} onClick={() => trade(card, "NO")}>Buy NO · $1</button>
                    </div>
                    <small>{card.ticker} · {card.trades24h} trades / 24h · {money(card.volume24h)} volume</small>
                  </article>
                );
              })}
              </section>
            </div>
            <section className="transaction-chat world-chat">
              <header>
                <div><Bot size={18} /></div>
                <span><strong>Oracle</strong><small><i /> World market agent</small></span>
                <b>LIVE AI</b>
              </header>
              <div className="transaction-messages" ref={worldMessagesRef}>
                {worldMessages.map((message, index) => (
                  <article className={message.role} key={index}>
                    <p>{message.content}</p>
                    {message.meta && <small>{message.meta}</small>}
                    {message.plan && (
                      <button
                        className="inline-plan"
                        onClick={() => setReview(message.plan ?? null)}
                      >
                        <span><ShieldCheck size={15} /> World trade ready</span>
                        <strong>{planSummary(message.plan).left} → {planSummary(message.plan).right}</strong>
                        <em>Review here in chat <ArrowRight size={14} /></em>
                      </button>
                    )}
                  </article>
                ))}
                {worldMessages.length === 1 && (
                  <div className="chat-prompts">
                    {[
                      "Which YES looks cheapest?",
                      "Which market has the strongest liquidity?",
                      "Challenge the top agent valuation",
                      cards[0] ? `Prepare $1 YES on ${cards[0].title}` : "",
                    ].filter(Boolean).map((prompt) => (
                      <button onClick={() => askWorld(prompt)} key={prompt}>{prompt}</button>
                    ))}
                  </div>
                )}
                {review && (
                  <TransactionReview
                    key={`${review.title}:${review.valueCents}`}
                    plan={review}
                    onClose={() => setReview(null)}
                  />
                )}
                {worldThinking && <div className="thinking"><i /><i /><i /></div>}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  askWorld(worldInput);
                }}
              >
                <textarea
                  value={worldInput}
                  onChange={(event) => setWorldInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      askWorld(worldInput);
                    }
                  }}
                  placeholder="Ask Oracle about these live markets…"
                  rows={2}
                />
                <button disabled={!worldInput.trim() || worldThinking}><Send size={17} /></button>
              </form>
            </section>
          </section>
        )}
      </section>
    </RoomShell>
  );
}

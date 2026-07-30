"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FlaskConical,
  Gauge,
  LockKeyhole,
  MessageSquare,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";
import { useProductAction, useProductState, type ProductState } from "@/lib/client-state";
import { PayboxSigningApp } from "@/components/paybox-signing-app";

export type ExperienceKind = "trade" | "intel" | "duel" | "quest";

type ChatMessage = {
  role: "agent" | "user";
  text: string;
  meta?: string;
  action?: "trade" | "automation";
};

type ExperienceConfig = {
  kind: ExperienceKind;
  index: string;
  route: string;
  label: string;
  title: string;
  description: string;
  agent: string;
  agentStatus: string;
  accent: string;
  starters: string[];
  initialMessages: ChatMessage[];
  replies: Record<string, string>;
};

const EXPERIENCES: Record<ExperienceKind, ExperienceConfig> = {
  trade: {
    kind: "trade",
    index: "01",
    route: "/trade",
    label: "Signal desk",
    title: "Trade the signal,\nnot the noise.",
    description: "A live desk that reads the market, buys better information, and turns evidence into a bounded trade.",
    agent: "Milo",
    agentStatus: "Watching 18 feeds",
    accent: "#f0ff6a",
    starters: [
      "Find one interesting trade",
      "What changed in the last hour?",
      "Spend 25¢ researching BTC",
      "Automate $1 every five minutes",
    ],
    initialMessages: [
      {
        role: "agent",
        text: "I’m tracking price, flows, social velocity and three paid feeds. BTC has a signal worth investigating, but not yet worth trading.",
        meta: "Just now · 0¢ spent",
      },
    ],
    replies: {
      "Find one interesting trade":
        "The cleanest setup is BTC strength against a flat risk market. I’d investigate exchange outflows before committing. The trade stays capped at $1 until the evidence improves.",
      "What changed in the last hour?":
        "Spot volume rose 18%, funding stayed neutral, and a large exchange outflow appeared 11 minutes ago. That combination is constructive, but one data provider has not confirmed it.",
      "Spend 25¢ researching BTC":
        "I’d allocate 8¢ to exchange flows, 6¢ to options skew and keep 11¢ unspent unless they disagree. The best agents buy only the missing evidence.",
      "Build a $5 experimental basket":
        "I’d split the experiment: $2 BTC momentum, $1 cbBTC accumulation, $1 stablecoin reserve and $1 uncommitted for a second signal. Each leg needs its own stop condition.",
      "Automate $1 every five minutes":
        "I can propose the existing bounded automation: exactly 1 USDC into cbBTC every five minutes, a $12 rolling-day cap, $25 lifetime cap and automatic expiry after 24 hours.",
    },
  },
  intel: {
    kind: "intel",
    index: "02",
    route: "/intel",
    label: "Research hunter",
    title: "Pay for answers,\nnot subscriptions.",
    description: "Give the agent a question and a tiny budget. It purchases only the evidence needed to reach a defensible answer.",
    agent: "Iris",
    agentStatus: "6 sources available",
    accent: "#ff815c",
    starters: [
      "Investigate today’s BTC move",
      "Find the strongest counterargument",
      "Is this signal independently confirmed?",
      "Show me what 25¢ buys",
    ],
    initialMessages: [
      {
        role: "agent",
        text: "I found four free explanations for today’s move. Three repeat the same anonymous source, so confidence is low. I can test the claim against paid flow data.",
        meta: "Research plan · 25¢ ceiling",
      },
    ],
    replies: {
      "Investigate today’s BTC move":
        "Plan: establish the timeline for free, spend 8¢ on exchange flows, then buy options data only if the flow result is ambiguous. Expected spend: 8–14¢.",
      "Find the strongest counterargument":
        "The strongest bear case is that spot buying is thin while leverage is rebuilding. If options skew confirms that, the apparent breakout is more fragile than the headlines imply.",
      "Is this signal independently confirmed?":
        "Not yet. Five articles resolve to two underlying sources. I would not count syndication as confirmation; one independent paid dataset would materially change the answer.",
      "Show me what 25¢ buys":
        "At current x402 prices: exchange flows for 8¢, options skew for 6¢, wallet clustering for 5¢ and a 6¢ reserve. The reserve remains yours unless a contradiction appears.",
    },
  },
  duel: {
    kind: "duel",
    index: "03",
    route: "/duel",
    label: "Agent arena",
    title: "Two agents enter.\nOne thesis leaves.",
    description: "Pit opposing strategies against the same market, interrogate their reasoning, then let the better argument earn the trade.",
    agent: "The Ref",
    agentStatus: "Round 1 ready",
    accent: "#9f8cff",
    starters: [
      "Start the first round",
      "Cross-examine Momentum",
      "Give both agents 10¢",
      "Let the winner place $1",
    ],
    initialMessages: [
      {
        role: "agent",
        text: "Momentum Goblin sees a breakout. Paranoid Quant sees crowded positioning. I’ll score evidence quality, not confidence. Start the round when you’re ready.",
        meta: "Arena funded · 20¢ research",
      },
    ],
    replies: {
      "Start the first round":
        "Round one is live. Momentum must prove real spot demand; Quant must prove the move is leverage-led. Each gets one paid source and 90 seconds.",
      "Cross-examine Momentum":
        "Momentum, separate price action from causality: what evidence shows buyers will remain after the headline fades? I’ve docked 6 points for relying on velocity alone.",
      "Give both agents 10¢":
        "Budget granted. Momentum bought exchange-flow data. Quant bought liquidation density. Neither may purchase a second source until they explain the first.",
      "Let the winner place $1":
        "I’ll permit a $1 trade only after the round closes and you approve the exact asset, direction and maximum loss. A persuasive personality is not an execution policy.",
    },
  },
  quest: {
    kind: "quest",
    index: "04",
    route: "/quest",
    label: "Onchain quest",
    title: "Follow the money.\nUnlock the story.",
    description: "A five-minute crypto mystery where your agent buys clues, traces wallets, and turns onchain evidence into a playable investigation.",
    agent: "Cleo",
    agentStatus: "Case #041 open",
    accent: "#64e6c4",
    starters: [
      "Give me a five-minute mystery",
      "Unlock the next clue",
      "Make the case more difficult",
      "Explain the wallet connection",
    ],
    initialMessages: [
      {
        role: "agent",
        text: "A dormant wallet woke up, crossed three protocols, and left exactly 0.000041 SOL behind. That residue is intentional. We have 50¢ and four clues.",
        meta: "Case #041 · 0¢ spent",
      },
    ],
    replies: {
      "Give me a five-minute mystery":
        "Case accepted. Your objective is to identify who controlled the final wallet without using an identity database. Start with timing, token provenance and repeated fee patterns.",
      "Unlock the next clue":
        "Clue unlocked for 7¢: all three transactions used the same priority-fee fingerprint. That links the supposedly unrelated wallets to one transaction builder.",
      "Make the case more difficult":
        "Hard mode enabled. Address labels are hidden, one clue is a deliberate red herring, and I’ll only reveal evidence after you state what would falsify your theory.",
      "Explain the wallet connection":
        "The addresses never transfer directly. Their connection is behavioral: identical fee selection, matching account order and activity within the same 14-second window.",
    },
  },
};

const roomLinks = (Object.keys(EXPERIENCES) as ExperienceKind[]).map((kind) => EXPERIENCES[kind]);

export function AgentExperience({ kind }: { kind: ExperienceKind }) {
  const config = EXPERIENCES[kind];
  const { data } = useProductState();
  const productAction = useProductAction();
  const [messages, setMessages] = useState<ChatMessage[]>(config.initialMessages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activity, setActivity] = useState(0);
  const [reviewAction, setReviewAction] = useState<"trade" | "automation" | null>(null);
  const [submittedExecution, setSubmittedExecution] =
    useState<ProductState["executions"][number] | null>(null);
  const [actionResult, setActionResult] = useState("");

  const connected = data?.connection?.status === "CONNECTED";
  const balance = data?.connection?.usdcBalanceAtomic
    ? (Number(data.connection.usdcBalanceAtomic) / 1e6).toFixed(2)
    : "—";

  const ask = (prompt: string) => {
    if (!prompt.trim() || isThinking) return;
    setMessages((current) => [...current, { role: "user", text: prompt.trim() }]);
    setInput("");
    setIsThinking(true);
    window.setTimeout(() => {
      const reply =
        config.replies[prompt] ??
        `I’d break “${prompt.trim()}” into evidence, cost and action. I can investigate within a fixed budget, show every source, and ask before any real transaction.`;
      const messageAction =
        kind === "trade" &&
        (prompt === "Find one interesting trade" ||
          prompt === "Build the trade plan" ||
          prompt.toLowerCase().includes("buy exactly $1"))
          ? "trade"
          : prompt === "Automate $1 every five minutes"
            ? "automation"
            : kind === "duel" && prompt === "Let the winner place $1"
              ? "trade"
              : undefined;
      setMessages((current) => [
        ...current,
        {
          role: "agent",
          text: reply,
          meta: messageAction ? "Action ready · nothing executed yet" : "Agent response · no transaction",
          action: messageAction,
        },
      ]);
      setActivity((value) => value + 1);
      setIsThinking(false);
    }, 650);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  const beginTrade = async () => {
    setActionResult("");
    try {
      const nextState = await productAction.mutateAsync({ action: "run-now" });
      const execution = nextState.executions[0] ?? null;
      setSubmittedExecution(execution);
      if (!execution) {
        setActionResult("No execution was created.");
      } else if (
        ["BLOCKED_BY_POLICY", "FAILED", "DENIED", "SKIPPED_PREVIOUS_EXECUTION_PENDING"].includes(
          execution.status,
        )
      ) {
        setActionResult(execution.errorMessage ?? `Trade stopped: ${execution.status.replaceAll("_", " ")}.`);
      } else if (execution.status === "SUCCESS") {
        setActionResult("Trade completed successfully.");
      } else {
        setActionResult("Trade request created. Complete the Paybox signing step below.");
      }
    } catch (error) {
      setActionResult(error instanceof Error ? error.message : "The trade could not be created.");
    }
  };

  const activate = async () => {
    setActionResult("");
    try {
      const nextState = await productAction.mutateAsync({
        action: "activate",
        confirmation: "ACTIVATE",
      });
      setActionResult(
        nextState.realRecurringExecutionEnabled
          ? "Automation activated."
          : "Automation saved, but real recurring execution remains disabled on the server.",
      );
    } catch (error) {
      setActionResult(error instanceof Error ? error.message : "Automation could not be activated.");
    }
  };

  const refreshSubmittedExecution = async () => {
    if (!submittedExecution) return;
    const nextState = await productAction.mutateAsync({
      action: "refresh-execution",
      executionId: submittedExecution.id,
    });
    const refreshed = nextState.executions.find((item) => item.id === submittedExecution.id) ?? null;
    setSubmittedExecution(refreshed);
    if (refreshed?.status === "SUCCESS") {
      setActionResult("Trade completed successfully.");
    }
  };

  const workspace = (() => {
    switch (kind) {
      case "trade":
        return <TradeWorkspace activity={activity} onAsk={ask} />;
      case "intel":
        return <IntelWorkspace activity={activity} onAsk={ask} />;
      case "duel":
        return <DuelWorkspace activity={activity} onAsk={ask} />;
      case "quest":
        return <QuestWorkspace activity={activity} onAsk={ask} />;
    }
  })();

  return (
    <main className={`experience experience-${kind}`} style={{ "--room-accent": config.accent } as React.CSSProperties}>
      <header className="experience-topbar">
        <Link href="/" className="experience-brand">
          <span className="experience-brand-mark"><Sparkles size={16} /></span>
          <span>Paybox Rooms</span>
        </Link>
        <nav className="room-switcher" aria-label="Agent experiences">
          {roomLinks.map((room) => (
            <Link href={room.route} className={room.kind === kind ? "active" : ""} key={room.route}>
              <span>{room.index}</span>{room.label}
            </Link>
          ))}
        </nav>
        <div className="wallet-state">
          <span className={connected ? "wallet-dot connected" : "wallet-dot"} />
          <span>{connected ? `${balance} USDC` : "Wallet offline"}</span>
          <Link href={connected ? "/dashboard" : "/connect"}>
            {connected ? <Gauge size={15} /> : <WalletCards size={15} />}
          </Link>
        </div>
      </header>

      <section className="experience-layout">
        <section className="experience-stage">
          <div className="experience-intro">
            <div>
              <p className="room-kicker"><span>{config.index}</span>{config.label}</p>
              <h1>{config.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
            </div>
            <p>{config.description}</p>
          </div>
          {workspace}
        </section>

        <aside className="chat-panel">
          <div className="chat-head">
            <div className="agent-avatar"><Bot size={18} /></div>
            <div>
              <strong>{config.agent}</strong>
              <span><i /> {config.agentStatus}</span>
            </div>
            <span className="model-pill">AGENT</span>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                {message.role === "agent" && <span className="message-avatar"><Sparkles size={12} /></span>}
                <div>
                  <p>{message.text}</p>
                  {message.meta && <small>{message.meta}</small>}
                  {message.action && (
                    <ChatActionCard
                      type={message.action}
                      automationStatus={data?.automation?.status ?? "NOT READY"}
                      onReview={() => {
                        setSubmittedExecution(null);
                        setActionResult("");
                        setReviewAction(message.action ?? null);
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="starter-grid">
                {config.starters.map((starter) => (
                  <button onClick={() => ask(starter)} key={starter}>
                    {starter}<ChevronRight size={14} />
                  </button>
                ))}
              </div>
            )}
            {isThinking && (
              <div className="chat-message agent">
                <span className="message-avatar"><Sparkles size={12} /></span>
                <div className="typing"><i /><i /><i /></div>
              </div>
            )}
          </div>

          <form className="chat-compose" onSubmit={submit}>
            <div className="compose-box">
              <textarea
                aria-label={`Message ${config.agent}`}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    ask(input);
                  }
                }}
                placeholder={`Ask ${config.agent} anything…`}
                rows={2}
              />
              <button type="submit" aria-label="Send message" disabled={!input.trim() || isThinking}>
                <Send size={16} />
              </button>
            </div>
            <div className="compose-meta">
              <span><ShieldCheck size={13} /> Real payments require policy checks</span>
              <span>⌘ ↵</span>
            </div>
          </form>
        </aside>
      </section>

      {reviewAction && (
        <div className="action-review-backdrop" role="presentation">
          <section className="action-review" role="dialog" aria-modal="true" aria-label={`Review ${reviewAction}`}>
            <div className="action-review-head">
              <div>
                <span>{reviewAction === "trade" ? "REAL TRANSACTION" : "RECURRING POLICY"}</span>
                <h2>{reviewAction === "trade" ? "Confirm this $1 trade" : "Confirm this automation"}</h2>
              </div>
              <button onClick={() => setReviewAction(null)} aria-label="Close review">×</button>
            </div>

            {reviewAction === "trade" ? (
              <>
                <div className="review-swap">
                  <div><span>YOU SPEND</span><strong>1.00 <small>USDC</small></strong></div>
                  <ArrowRight size={20} />
                  <div><span>YOU RECEIVE</span><strong>cbBTC <small>quoted by Paybox</small></strong></div>
                </div>
                <div className="review-facts">
                  <span><b>Network</b>Solana mainnet</span>
                  <span><b>Maximum slippage</b>1.00%</span>
                  <span><b>Wallet</b>{data?.connection?.selectedWalletName ?? "Not selected"}</span>
                </div>
                {!submittedExecution && (
                  <button className="confirm-real-action" onClick={beginTrade} disabled={productAction.isPending}>
                    {productAction.isPending ? "Creating Paybox request…" : "Confirm and create $1 trade"}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="automation-review-grid">
                  <div><span>AMOUNT</span><strong>1 USDC</strong></div>
                  <div><span>FREQUENCY</span><strong>Every 5 minutes</strong></div>
                  <div><span>ROLLING DAY</span><strong>Maximum $12</strong></div>
                  <div><span>EXPIRY</span><strong>After 24 hours</strong></div>
                </div>
                <div className="automation-policy-note">
                  <ShieldCheck size={17} />
                  <p>
                    Current status: <b>{data?.automation?.status ?? "UNKNOWN"}</b>.{" "}
                    {data?.realRecurringExecutionEnabled
                      ? "Real recurring execution is enabled."
                      : "The server switch for real recurring execution is currently off."}
                  </p>
                </div>
                {data?.automation?.status === "READY" ? (
                  <button className="confirm-real-action" onClick={activate} disabled={productAction.isPending}>
                    {productAction.isPending ? "Activating…" : "Confirm automation"}
                  </button>
                ) : data?.automation?.status === "ACTIVE" ? (
                  <Link className="confirm-real-action" href="/dashboard">Automation is active · open controls</Link>
                ) : (
                  <Link className="confirm-real-action" href="/setup">Complete the $1 test first</Link>
                )}
              </>
            )}

            {actionResult && <p className="action-result">{actionResult}</p>}

            {reviewAction === "trade" &&
              submittedExecution &&
              data?.mode === "real" &&
              ["PENDING_SIGNATURE", "PENDING_USER_APPROVAL", "PENDING_CONFIRMATION", "PENDING_SETTLEMENT"].includes(
                submittedExecution.status,
              ) &&
              data.connection?.selectedCredentialId && (
                <div className="inline-paybox-signer">
                  <PayboxSigningApp
                    executionId={submittedExecution.id}
                    credentialId={data.connection.selectedCredentialId}
                    toolResult={submittedExecution.providerResponseJson ?? {}}
                    onRequestChanged={refreshSubmittedExecution}
                  />
                </div>
              )}
          </section>
        </div>
      )}
    </main>
  );
}

function ChatActionCard({
  type,
  automationStatus,
  onReview,
}: {
  type: "trade" | "automation";
  automationStatus: string;
  onReview: () => void;
}) {
  return (
    <div className={`chat-action-card ${type}`}>
      <div className="chat-action-label">
        {type === "trade" ? <Zap size={13} /> : <Radio size={13} />}
        {type === "trade" ? "PROPOSED TRADE" : "PROPOSED AUTOMATION"}
      </div>
      {type === "trade" ? (
        <>
          <div className="chat-action-swap"><strong>1 USDC</strong><ArrowRight size={14} /><strong>cbBTC</strong></div>
          <span>Solana · maximum 1% slippage</span>
          <button onClick={onReview}>Review and confirm <ChevronRight size={14} /></button>
        </>
      ) : (
        <>
          <div className="chat-action-swap"><strong>$1</strong><ArrowRight size={14} /><strong>Every 5 min</strong></div>
          <span>$12 daily · $25 lifetime · 24h expiry</span>
          <button onClick={onReview}>
            {automationStatus === "ACTIVE" ? "View automation" : "Review automation"} <ChevronRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}

function PanelTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="workspace-title">
      <div><span>{eyebrow}</span><h2>{title}</h2></div>
      {action}
    </div>
  );
}

function TradeWorkspace({ activity, onAsk }: { activity: number; onAsk: (prompt: string) => void }) {
  const signals = [
    { time: "12:41", source: "Exchange flow", title: "Large BTC outflow detected", detail: "2,840 BTC moved to new custody clusters", tone: "positive", price: "8¢" },
    { time: "12:36", source: "Options desk", title: "Skew remains neutral", detail: "No rush for upside protection despite spot move", tone: "neutral", price: "6¢" },
    { time: "12:29", source: "Social velocity", title: "Headline acceleration", detail: "Mentions +41%, unique authors only +9%", tone: "warning", price: "FREE" },
  ];
  return (
    <div className="workspace trade-workspace">
      <div className="market-strip">
        <div><span>BTC / USD</span><strong>$118,420</strong><small className="up">+2.4%</small></div>
        <div><span>Signal</span><strong>Constructive</strong><small>68 / 100</small></div>
        <div><span>Research spent</span><strong>{activity ? "14¢" : "0¢"}</strong><small>25¢ ceiling</small></div>
        <div className="market-live"><Radio size={14} /> LIVE</div>
      </div>
      <div className="workspace-grid trade-grid">
        <section className="workspace-card signal-feed">
          <PanelTitle eyebrow="Processed intelligence" title="Signal feed" action={<button onClick={() => onAsk("What changed in the last hour?")}>Ask Milo <MessageSquare size={13} /></button>} />
          <div className="signal-list">
            {signals.map((signal) => (
              <article key={signal.title}>
                <time>{signal.time}</time>
                <div className={`signal-mark ${signal.tone}`} />
                <div>
                  <span>{signal.source}</span>
                  <h3>{signal.title}</h3>
                  <p>{signal.detail}</p>
                </div>
                <b>{signal.price}</b>
              </article>
            ))}
          </div>
        </section>
        <section className="workspace-card thesis-card">
          <PanelTitle eyebrow="Current thesis" title="Spot-led strength" action={<span className="score-ring">68</span>} />
          <div className="mini-chart">
            {[28, 31, 29, 42, 38, 51, 48, 64, 61, 75, 72, 88].map((height, index) => <i style={{ height: `${height}%` }} key={index} />)}
          </div>
          <div className="thesis-points">
            <span><Check size={13} /> Exchange supply falling</span>
            <span><Check size={13} /> Funding still neutral</span>
            <span className="open"><Search size={13} /> Buyer persistence unknown</span>
          </div>
          <button className="workspace-primary" onClick={() => onAsk("Find one interesting trade")}>
            Build the trade plan <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
}

function IntelWorkspace({ activity, onAsk }: { activity: number; onAsk: (prompt: string) => void }) {
  const purchased = activity > 0;
  return (
    <div className="workspace intel-workspace">
      <div className="research-query">
        <Search size={19} />
        <div><span>Active investigation</span><strong>What actually caused today’s BTC move?</strong></div>
        <span className="budget-chip"><CircleDollarSign size={14} /> 25¢ budget</span>
      </div>
      <div className="workspace-grid intel-grid">
        <section className="workspace-card evidence-card">
          <PanelTitle eyebrow="Investigation map" title="Evidence, not repetition" />
          <div className="evidence-map">
            <div className="evidence-node root"><Search size={15} /><span>Market move</span><b>+2.4%</b></div>
            <div className="evidence-branch" />
            <div className="evidence-sources">
              <div className="evidence-node repeated"><span>5 articles</span><b>2 sources</b><small>Repeated claim</small></div>
              <div className={`evidence-node paid ${purchased ? "unlocked" : ""}`}><LockKeyhole size={14} /><span>Exchange flows</span><b>{purchased ? "Unlocked" : "8¢"}</b><small>{purchased ? "Independent data" : "x402 source"}</small></div>
              <div className="evidence-node"><span>Options skew</span><b>6¢</b><small>Optional check</small></div>
            </div>
          </div>
          <div className="confidence-line"><span>Answer confidence</span><i><b style={{ width: purchased ? "76%" : "42%" }} /></i><strong>{purchased ? "76%" : "42%"}</strong></div>
        </section>
        <section className="workspace-card source-ledger">
          <PanelTitle eyebrow="Source ledger" title="Every cent explained" />
          <div className="ledger-row head"><span>Source</span><span>Value</span><span>Cost</span></div>
          <div className="ledger-row"><span>Public news</span><span className="weak">Duplicated</span><b>FREE</b></div>
          <div className="ledger-row"><span>Flowglass</span><span className={purchased ? "strong" : ""}>{purchased ? "Confirmed" : "High"}</span><b>8¢</b></div>
          <div className="ledger-row"><span>Vol Surface</span><span>Medium</span><b>6¢</b></div>
          <div className="ledger-total"><span>Committed</span><strong>{purchased ? "8¢" : "0¢"}</strong><small>of 25¢</small></div>
          <button className="workspace-primary" onClick={() => onAsk("Spend 25¢ researching BTC")}>
            <Zap size={15} /> Run the research plan
          </button>
        </section>
      </div>
    </div>
  );
}

function DuelWorkspace({ activity, onAsk }: { activity: number; onAsk: (prompt: string) => void }) {
  const roundLive = activity > 0;
  return (
    <div className="workspace duel-workspace">
      <div className="arena-scoreboard">
        <span>ROUND {roundLive ? "01 LIVE" : "00 READY"}</span>
        <div><i style={{ width: roundLive ? "56%" : "50%" }} /><b>VS</b></div>
        <small>Evidence quality decides the winner</small>
      </div>
      <div className="workspace-grid duel-grid">
        <section className="workspace-card fighter momentum">
          <div className="fighter-head"><span className="fighter-avatar"><Zap size={20} /></span><div><small>AGENT A</small><h2>Momentum Goblin</h2></div><strong>{roundLive ? "56" : "50"}</strong></div>
          <p>“Price is information. The breakout is happening while everyone waits for perfect confirmation.”</p>
          <div className="fighter-evidence">
            <span><Check size={13} /> Spot volume expanding</span>
            <span><Check size={13} /> Funding remains neutral</span>
            <span className="weak"><Target size={13} /> Persistence unproven</span>
          </div>
          <button onClick={() => onAsk("Cross-examine Momentum")}>Cross-examine <ChevronRight size={14} /></button>
        </section>
        <section className="workspace-card fighter quant">
          <div className="fighter-head"><span className="fighter-avatar"><FlaskConical size={20} /></span><div><small>AGENT B</small><h2>Paranoid Quant</h2></div><strong>{roundLive ? "44" : "50"}</strong></div>
          <p>“A move without independent flow confirmation is a story, not a signal. Show me who is buying.”</p>
          <div className="fighter-evidence">
            <span><Check size={13} /> Leverage rebuilding</span>
            <span><Check size={13} /> Social breadth is weak</span>
            <span className="weak"><Target size={13} /> Flow data pending</span>
          </div>
          <button onClick={() => onAsk("Give both agents 10¢")}>Fund evidence <ChevronRight size={14} /></button>
        </section>
      </div>
      <button className="arena-start" onClick={() => onAsk("Start the first round")}>
        <Swords size={17} /> {roundLive ? "Run another exchange" : "Start the first round"}
      </button>
    </div>
  );
}

function QuestWorkspace({ activity, onAsk }: { activity: number; onAsk: (prompt: string) => void }) {
  const step = Math.min(3, activity);
  const clues = [
    { label: "Dormant wallet", detail: "Woke after 418 days", icon: WalletCards },
    { label: "Protocol hop", detail: step >= 1 ? "Fee fingerprint found" : "Locked · 7¢", icon: ExternalLink },
    { label: "Final address", detail: step >= 2 ? "Behavioral match" : "Unknown controller", icon: Target },
    { label: "Case solved", detail: step >= 3 ? "Identity pattern found" : "Requires 3 clues", icon: Trophy },
  ];
  return (
    <div className="workspace quest-workspace">
      <div className="case-strip">
        <div><span>CASE</span><strong>#041</strong></div>
        <p>A dormant wallet crossed three protocols and left a deliberate trace.</p>
        <div><span>CLUE BUDGET</span><strong>{50 - step * 7}¢</strong></div>
      </div>
      <section className="workspace-card quest-map-card">
        <PanelTitle eyebrow="Onchain trail" title="The residue mystery" action={<span className="case-difficulty">NORMAL</span>} />
        <div className="quest-map">
          {clues.map(({ label, detail, icon: Icon }, index) => (
            <div className={`quest-node ${index <= step ? "unlocked" : ""}`} key={label}>
              <span className="quest-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="quest-icon">{index <= step ? <Icon size={18} /> : <LockKeyhole size={17} />}</div>
              <strong>{label}</strong>
              <small>{detail}</small>
              {index < clues.length - 1 && <ArrowRight className="quest-arrow" size={19} />}
            </div>
          ))}
        </div>
        <div className="quest-bottom">
          <div><span>Evidence collected</span><strong>{step + 1} / 4</strong></div>
          <div className="quest-progress"><i style={{ width: `${25 + step * 25}%` }} /></div>
          <button className="workspace-primary" onClick={() => onAsk("Unlock the next clue")}>
            Unlock next clue · 7¢ <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}

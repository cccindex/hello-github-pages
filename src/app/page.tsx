import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

const facts = [
  "1 USDC per purchase",
  "Every five minutes",
  "Solana mainnet",
  "cbBTC",
  "$12 rolling daily maximum",
  "$25 lifetime maximum",
  "Stops after 24 hours",
];

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <div className="brand"><span className="brand-mark">₿</span> Five Minute Bitcoin</div>
        <span className="local-pill">Hosted prototype</span>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">1 USDC → cbBTC on Solana</p>
          <h1>Buy $1 of Bitcoin every five minutes.</h1>
          <p className="hero-lede">
            Connect your Paybox wallet once. Five Minute Bitcoin automatically
            swaps exactly 1 USDC into cbBTC within strict limits you can pause or
            revoke at any time.
          </p>
          <div className="button-row">
            <Link href="/connect" className="button button-primary">
              Start setup <ArrowRight size={17} />
            </Link>
            <a href="#how" className="button button-secondary">See how it works</a>
          </div>
          <p className="trust-note"><ShieldCheck size={17} /> Real execution is locked off by default.</p>
        </div>
        <div className="hero-card">
          <div className="hero-card-top">
            <span>Fixed purchase</span>
            <span className="live-dot">Mock ready</span>
          </div>
          <strong className="swap-amount">1.00 <small>USDC</small></strong>
          <div className="swap-arrow">↓</div>
          <strong className="swap-amount">cbBTC <small>Solana</small></strong>
          <div className="hero-rule" />
          <div className="hero-card-row"><span>Frequency</span><b>Every 5 minutes</b></div>
          <div className="hero-card-row"><span>Maximum today</span><b>$12.00</b></div>
          <div className="hero-card-row"><span>Lifetime cap</span><b>$25.00</b></div>
        </div>
      </section>
      <section className="how" id="how">
        <p className="eyebrow">One narrow workflow</p>
        <div className="flow-grid">
          {["Connect wallet", "Test one purchase", "Activate automation", "Receive cbBTC"].map(
            (step, index) => (
              <div className="flow-step" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
                {index < 3 && <ArrowRight size={16} />}
              </div>
            ),
          )}
        </div>
        <div className="facts">
          {facts.map((fact) => <span key={fact}><Check size={14} /> {fact}</span>)}
        </div>
      </section>
      <footer className="landing-footer">
        <p>
          Experimental recurring swap prototype. cbBTC is a wrapped representation
          of Bitcoin on Solana. It is not native Bitcoin.
        </p>
      </footer>
    </main>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  FlaskConical,
  LineChart,
  Radio,
  Sparkles,
} from "lucide-react";

const rooms = [
  {
    index: "01",
    route: "/trade",
    label: "AI transact",
    title: "Say the transaction",
    description: "Chat with an AI that resolves verified assets, composes the proper Paybox operation, and shows the full transaction before signing.",
    icon: Bot,
    accent: "#f0ff6a",
  },
  {
    index: "02",
    route: "/intel",
    label: "Stock RSA feed",
    title: "Read the xStocks tape",
    description: "Live Solana tokenized-stock prices, volume, liquidity and issuer-price gaps ranked for agent research.",
    icon: LineChart,
    accent: "#ff815c",
  },
  {
    index: "03",
    route: "/predictions",
    label: "World markets",
    title: "Trade the probability",
    description: "Live prediction markets, order-book-driven valuation screens, and exact YES/NO outcome trades through Paybox.",
    icon: Radio,
    accent: "#64e6c4",
  },
];

export default function Home() {
  return (
    <main className="rooms-home">
      <header className="rooms-nav">
        <Link href="/" className="experience-brand">
          <span className="experience-brand-mark"><Sparkles size={16} /></span>
          <span>Paybox Rooms</span>
        </Link>
        <div className="rooms-nav-actions">
          <Link href="/dashboard"><FlaskConical size={12} /> Bitcoin autopilot</Link>
          <Link href="/connect">Connect Paybox <ArrowRight size={12} /></Link>
        </div>
      </header>
      <section className="rooms-hero">
        <p>Three live rooms. One Paybox wallet.</p>
        <h1>Give the internet a budget.</h1>
        <p>
          Live market research and chat-first execution where every real action
          stays visible, bounded, and signed through Paybox.
        </p>
        <div className="rooms-start">
          <Link href="/connect">Connect Paybox to start <ArrowRight size={17} /></Link>
          <span>No app login · choose your wallet · run a visible $1 test</span>
        </div>
      </section>
      <section className="rooms-grid">
        {rooms.map(({ index, route, label, title, description, icon: Icon, accent }) => (
          <Link
            href={route}
            className="room-card"
            style={{ "--card-accent": accent } as React.CSSProperties}
            key={route}
          >
            <div className="room-card-top"><span>{index}</span><span>{label.toUpperCase()}</span></div>
            <div className="room-card-icon"><Icon size={22} /></div>
            <h2>{title}</h2>
            <p>{description}</p>
            <div className="room-card-link">Enter room <ArrowRight size={15} /></div>
          </Link>
        ))}
      </section>
    </main>
  );
}

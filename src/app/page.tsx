import Link from "next/link";
import {
  ArrowRight,
  Bot,
  FlaskConical,
  Search,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";

const rooms = [
  {
    index: "01",
    route: "/trade",
    label: "Signal desk",
    title: "Trade the signal",
    description: "A live market desk that reads free and paid feeds, challenges its own thesis, and builds a bounded trade.",
    icon: Bot,
    accent: "#f0ff6a",
  },
  {
    index: "02",
    route: "/intel",
    label: "Research hunter",
    title: "Buy the evidence",
    description: "Give an agent a question and a tiny budget. Watch it decide which x402 sources are actually worth paying for.",
    icon: Search,
    accent: "#ff815c",
  },
  {
    index: "03",
    route: "/duel",
    label: "Agent arena",
    title: "Make agents argue",
    description: "Two opposing strategies face the same market. Evidence quality—not personality—decides who earns the trade.",
    icon: Swords,
    accent: "#9f8cff",
  },
  {
    index: "04",
    route: "/quest",
    label: "Onchain quest",
    title: "Follow the money",
    description: "Play a five-minute crypto mystery where your agent purchases clues and traces behavior across the chain.",
    icon: Target,
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
        <p>Four agents. Four links. One wallet.</p>
        <h1>Give the internet a budget.</h1>
        <p>
          Chat-first experiments where AI can investigate, debate, play and
          transact—while every paid action stays visible and bounded.
        </p>
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

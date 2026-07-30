"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bitcoin,
  Gauge,
  Link2,
  Settings,
  WalletCards,
} from "lucide-react";
import { useProductState } from "@/lib/client-state";
import { Badge } from "@/components/ui";

const items = [
  { href: "/connect", label: "Connect", icon: Link2 },
  { href: "/setup", label: "Wallet setup", icon: WalletCards },
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useProductState();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark"><Bitcoin size={19} /></span>
          <span>Five Minute<br />Bitcoin</span>
        </Link>
        <nav>
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              className={`${pathname === href ? "active" : ""} ${
                href === "/connect" && data?.connection?.status !== "CONNECTED"
                  ? "connect-nav-cta"
                  : ""
              }`}
              href={href}
              key={href}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Badge status={data?.mode === "real" ? "REAL MODE" : "MOCK MODE"} />
          <small>Hosted private database</small>
        </div>
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}

export function ProductLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

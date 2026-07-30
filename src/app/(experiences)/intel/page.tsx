import type { Metadata } from "next";
import { StocksRoom } from "@/components/live-rooms";

export const metadata: Metadata = {
  title: "Solana xStocks Feed · Paybox Rooms",
  description: "A live, agent-ready feed for tokenized stocks on Solana.",
};

export default function IntelPage() {
  return <StocksRoom />;
}

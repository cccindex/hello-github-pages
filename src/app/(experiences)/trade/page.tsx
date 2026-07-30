import type { Metadata } from "next";
import { TradeRoom } from "@/components/live-rooms";

export const metadata: Metadata = {
  title: "Signal Desk · Paybox Rooms",
  description: "An AI trading desk that turns paid intelligence into bounded trade plans.",
};

export default function TradePage() {
  return <TradeRoom />;
}

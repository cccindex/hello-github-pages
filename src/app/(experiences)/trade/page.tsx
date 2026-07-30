import type { Metadata } from "next";
import { AgentExperience } from "@/components/agent-experience";

export const metadata: Metadata = {
  title: "Signal Desk · Paybox Rooms",
  description: "An AI trading desk that turns paid intelligence into bounded trade plans.",
};

export default function TradePage() {
  return <AgentExperience kind="trade" />;
}

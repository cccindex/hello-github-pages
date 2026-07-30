import type { Metadata } from "next";
import { AgentExperience } from "@/components/agent-experience";

export const metadata: Metadata = {
  title: "Agent Arena · Paybox Rooms",
  description: "Two AI strategies debate the same market and compete on evidence.",
};

export default function DuelPage() {
  return <AgentExperience kind="duel" />;
}

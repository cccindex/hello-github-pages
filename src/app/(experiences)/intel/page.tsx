import type { Metadata } from "next";
import { AgentExperience } from "@/components/agent-experience";

export const metadata: Metadata = {
  title: "Research Hunter · Paybox Rooms",
  description: "An AI research agent that purchases only the evidence it needs.",
};

export default function IntelPage() {
  return <AgentExperience kind="intel" />;
}

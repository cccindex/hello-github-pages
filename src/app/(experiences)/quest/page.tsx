import type { Metadata } from "next";
import { AgentExperience } from "@/components/agent-experience";

export const metadata: Metadata = {
  title: "Onchain Quest · Paybox Rooms",
  description: "A playable onchain investigation where an AI agent purchases clues.",
};

export default function QuestPage() {
  return <AgentExperience kind="quest" />;
}

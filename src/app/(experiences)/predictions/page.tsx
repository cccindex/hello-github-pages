import type { Metadata } from "next";
import { PredictionsRoom } from "@/components/live-rooms";

export const metadata: Metadata = {
  title: "World Prediction Markets · Paybox Rooms",
  description: "Live World prediction markets, agent valuation screens, and Paybox execution.",
};

export default function PredictionsPage() {
  return <PredictionsRoom />;
}

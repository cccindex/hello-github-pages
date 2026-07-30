import { NextResponse } from "next/server";
import { z } from "zod";
import {
  activateAutomation,
  approveTestPurchase,
  connectMockPaybox,
  createExecution,
  getLocalState,
  resetLocalData,
  revokeAccess,
  selectMockWallet,
  setAutomationStatus,
  triggerSchedulerDelivery,
} from "@/lib/service";
import { ExecutionType } from "@prisma/client";
import {
  corsPreflight,
  rejectDisallowedOrigin,
  withCors,
} from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const rejected = rejectDisallowedOrigin(request);
  if (rejected) return rejected;
  return withCors(request, NextResponse.json(await getLocalState()));
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect") }),
  z.object({ action: z.literal("select-wallet"), credentialId: z.string() }),
  z.object({ action: z.literal("run-test") }),
  z.object({ action: z.literal("approve-test"), executionId: z.string() }),
  z.object({ action: z.literal("activate"), confirmation: z.string() }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("run-now") }),
  z.object({ action: z.literal("run-scheduler"), scheduledAt: z.string().datetime().optional() }),
  z.object({ action: z.literal("reset") }),
]);

export async function POST(request: Request) {
  const rejected = rejectDisallowedOrigin(request);
  if (rejected) return rejected;
  try {
    const input = actionSchema.parse(await request.json());
    switch (input.action) {
      case "connect":
        await connectMockPaybox();
        break;
      case "select-wallet":
        await selectMockWallet(input.credentialId);
        break;
      case "run-test":
        await createExecution(ExecutionType.TEST_PURCHASE);
        break;
      case "approve-test":
        await approveTestPurchase(input.executionId);
        break;
      case "activate":
        await activateAutomation(input.confirmation);
        break;
      case "pause":
      case "resume":
        await setAutomationStatus(input.action);
        break;
      case "revoke":
        await revokeAccess();
        break;
      case "run-now":
        await createExecution(ExecutionType.MANUAL_PURCHASE);
        break;
      case "run-scheduler":
        await triggerSchedulerDelivery(
          input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        );
        break;
      case "reset":
        await resetLocalData();
        break;
    }
    return withCors(request, NextResponse.json(await getLocalState()));
  } catch (error) {
    return withCors(
      request,
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 400 },
      ),
    );
  }
}

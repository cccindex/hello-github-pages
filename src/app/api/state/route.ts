import { NextResponse } from "next/server";
import { z } from "zod";
import {
  activateAutomation,
  approveTestPurchase,
  connectMockPaybox,
  createExecution,
  getLocalState,
  refreshExecution,
  resetLocalData,
  revokeAccess,
  selectMockWallet,
  setAutomationStatus,
  triggerSchedulerDelivery,
} from "@/lib/service";
import { ExecutionStatus, ExecutionType } from "@prisma/client";
import { env } from "@/lib/env";
import { selectRealPayboxWallet } from "@/lib/paybox/real-provider";
import {
  corsPreflight,
  rejectDisallowedOrigin,
  withCors,
} from "@/lib/cors";
import {
  resolveBrowserSession,
  setBrowserSessionCookie,
} from "@/lib/browser-session";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const rejected = rejectDisallowedOrigin(request);
  if (rejected) return rejected;
  const session = resolveBrowserSession(request);
  const response = withCors(
    request,
    NextResponse.json(await getLocalState(session.localUserId)),
  );
  return setBrowserSessionCookie(response, session);
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
  z.object({ action: z.literal("refresh-execution"), executionId: z.string() }),
  z.object({ action: z.literal("reset") }),
]);

export async function POST(request: Request) {
  const rejected = rejectDisallowedOrigin(request);
  if (rejected) return rejected;
  try {
    const session = resolveBrowserSession(request);
    const localUserId = session.localUserId;
    const input = actionSchema.parse(await request.json());
    switch (input.action) {
      case "connect":
        if (env.PAYBOX_MODE !== "mock") {
          throw new Error("Use the Paybox OAuth connection flow.");
        }
        await connectMockPaybox(localUserId);
        break;
      case "select-wallet":
        if (env.PAYBOX_MODE === "real") {
          await selectRealPayboxWallet(localUserId, input.credentialId);
        } else {
          await selectMockWallet(localUserId, input.credentialId);
        }
        break;
      case "run-test":
        const testExecution = await createExecution(
          localUserId,
          ExecutionType.TEST_PURCHASE,
        );
        if (
          testExecution.status === ExecutionStatus.BLOCKED_BY_POLICY ||
          testExecution.status === ExecutionStatus.FAILED
        ) {
          throw new Error(
            testExecution.errorMessage ??
              "The test purchase was blocked before any funds were moved.",
          );
        }
        break;
      case "approve-test":
        await approveTestPurchase(localUserId, input.executionId);
        break;
      case "activate":
        await activateAutomation(localUserId, input.confirmation);
        break;
      case "pause":
      case "resume":
        await setAutomationStatus(localUserId, input.action);
        break;
      case "revoke":
        await revokeAccess(localUserId);
        break;
      case "run-now":
        await createExecution(localUserId, ExecutionType.MANUAL_PURCHASE);
        break;
      case "run-scheduler":
        await triggerSchedulerDelivery(
          localUserId,
          input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        );
        break;
      case "refresh-execution":
        await refreshExecution(localUserId, input.executionId);
        break;
      case "reset":
        await resetLocalData(localUserId);
        break;
    }
    const response = withCors(
      request,
      NextResponse.json(await getLocalState(localUserId)),
    );
    return setBrowserSessionCookie(response, session);
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

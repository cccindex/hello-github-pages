import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { callPayboxSigningTool } from "@/lib/paybox/real-provider";
import { resolveBrowserSession } from "@/lib/browser-session";

const schema = z.object({
  executionId: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()).default({}),
});

export async function POST(request: Request) {
  try {
    const session = resolveBrowserSession(request);
    if (session.isNew) throw new Error("Connect Paybox first.");
    const input = schema.parse(await request.json());
    const execution = await db.execution.findUniqueOrThrow({
      where: { id: input.executionId },
      include: { user: true },
    });
    if (execution.user.localUserId !== session.localUserId) {
      throw new Error("Execution not found.");
    }
    if (!execution.providerRequestId) {
      throw new Error("This execution has no Paybox request.");
    }
    if (input.arguments.request_id !== execution.providerRequestId) {
      throw new Error("The signing call does not match this execution.");
    }
    return NextResponse.json(
      await callPayboxSigningTool(
        session.localUserId,
        input.name,
        input.arguments,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Paybox signing call failed." },
      { status: 400 },
    );
  }
}

"use client";

import { ArrowRight, Check, LockKeyhole, PlugZap } from "lucide-react";
import Link from "next/link";
import { WithState } from "@/components/page-state";
import { Badge, Button, Card } from "@/components/ui";

export default function ConnectPage() {
  return (
    <WithState>
      {(state, action) => {
        const connected = state.connection?.status === "CONNECTED";
        return (
          <div className="page">
            <div className="page-heading">
              <p className="eyebrow">Setup · Step 1 of 2</p>
              <h1>Connect your accounts</h1>
              <p>Local identity and Paybox access stay separate by design.</p>
            </div>
            <div className="setup-stack">
              <Card className="setup-card complete">
                <div className="step-index"><Check size={18} /></div>
                <div className="setup-card-body">
                  <div className="setup-title-row"><h2>Local sign in</h2><Badge status="CONNECTED" /></div>
                  <p>You are signed into this private local instance as <b>{state.user.email}</b>.</p>
                  <div className="safe-row"><LockKeyhole size={15} /> No hosted account or shared data.</div>
                </div>
              </Card>
              <Card className={connected ? "setup-card complete" : "setup-card"}>
                <div className="step-index">{connected ? <Check size={18} /> : "2"}</div>
                <div className="setup-card-body">
                  <div className="setup-title-row">
                    <h2>Connect Paybox</h2>
                    <Badge status={state.connection?.status ?? "NOT_CONNECTED"} />
                  </div>
                  <p>
                    Paybox lets this application request transactions from a wallet
                    you explicitly grant. It remains the signing and permission layer.
                  </p>
                  {!connected ? (
                    <div className="button-row">
                      <Button
                        onClick={() => action.mutate({ action: "connect" })}
                        disabled={action.isPending}
                      >
                        <PlugZap size={17} /> Connect mock Paybox
                      </Button>
                    </div>
                  ) : (
                    <div className="connected-box">
                      <div><span>Provider</span><strong>Mock Paybox</strong></div>
                      <div><span>Connection</span><strong>Local session</strong></div>
                      <Link href="/setup">Choose wallet <ArrowRight size={15} /></Link>
                    </div>
                  )}
                </div>
              </Card>
              <div className="note-box">
                <strong>Live connection status</strong>
                <p>
                  Paybox&apos;s OAuth 2.1 discovery endpoints are available. We will
                  inspect authenticated MCP tools separately before enabling real mode.
                </p>
              </div>
            </div>
          </div>
        );
      }}
    </WithState>
  );
}

"use client";

import { ArrowRight, Check, LockKeyhole, PlugZap, WalletCards } from "lucide-react";
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
              <p className="eyebrow">Start here · Takes about one minute</p>
              <h1>Connect Paybox</h1>
              <p>No app login. Connect Paybox, choose your wallet, then approve a visible $1 test.</p>
            </div>

            <div className="onboarding-progress" aria-label="Setup steps">
              <div className={connected ? "done" : "current"}>
                <span>{connected ? <Check size={15} /> : "1"}</span>
                <div><b>Connect Paybox</b><small>Authorize this browser</small></div>
              </div>
              <ArrowRight size={16} />
              <div>
                <span>2</span>
                <div><b>Choose wallet</b><small>Select the wallet to grant</small></div>
              </div>
              <ArrowRight size={16} />
              <div>
                <span>3</span>
                <div><b>Run $1 test</b><small>Review before funds move</small></div>
              </div>
            </div>

            <div className="setup-stack">
              <Card className={connected ? "setup-card complete connect-focus-card" : "setup-card connect-focus-card"}>
                <div className="step-index">{connected ? <Check size={18} /> : "1"}</div>
                <div className="setup-card-body">
                  <div className="setup-title-row">
                    <h2>{connected ? "Paybox connected" : "Click here to connect"}</h2>
                    <Badge status={state.connection?.status ?? "NOT_CONNECTED"} />
                  </div>
                  <p>
                    {connected
                      ? "Your Paybox authorization belongs only to this browser session. Continue to choose its wallet."
                      : "Paybox opens, asks you to authorize access, and sends you straight back here."}
                  </p>
                  {!connected ? (
                    <>
                      <div className="button-row connect-main-action">
                        {state.mode === "real" ? (
                          <Link className="button button-primary" href="/api/paybox/connect">
                            <PlugZap size={19} /> Connect Paybox now <ArrowRight size={17} />
                          </Link>
                        ) : (
                          <Button
                            onClick={() => action.mutate({ action: "connect" })}
                            disabled={action.isPending}
                          >
                            <PlugZap size={19} /> Connect mock Paybox
                          </Button>
                        )}
                      </div>
                      <div className="safe-row">
                        <LockKeyhole size={15} /> You approve access inside Paybox. This site never asks for your seed phrase.
                      </div>
                    </>
                  ) : (
                    <div className="connected-box">
                      <div><span>Provider</span><strong>{state.mode === "real" ? "Paybox" : "Mock Paybox"}</strong></div>
                      <div><span>Next step</span><strong>Choose a wallet</strong></div>
                      <Link href="/setup">Continue <ArrowRight size={15} /></Link>
                    </div>
                  )}
                </div>
              </Card>

              <div className="note-box">
                <strong>{connected ? "Paybox is connected — continue to wallet setup" : "What happens after you click?"}</strong>
                <p>
                  {connected
                    ? "Choose the wallet you want this browser to use, then run the visible $1 test. Nothing is automated just by connecting."
                    : "Sign in or create your Paybox account there, grant access, and return here. Every visitor gets a separate private browser session."}
                </p>
                {connected && (
                  <Link className="button button-primary onboarding-next" href="/setup">
                    <WalletCards size={17} /> Choose my wallet <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      }}
    </WithState>
  );
}

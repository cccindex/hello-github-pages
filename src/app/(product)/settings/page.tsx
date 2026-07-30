"use client";

import { AlertTriangle, RotateCcw, ShieldOff } from "lucide-react";
import { WithState } from "@/components/page-state";
import { Address, Badge, Button, Card } from "@/components/ui";

export default function SettingsPage() {
  return (
    <WithState>
      {(state, action) => (
        <div className="page">
          <div className="page-heading"><p className="eyebrow">Local configuration</p><h1>Settings</h1><p>Identity, connection, fixed limits, and emergency controls.</p></div>
          <div className="settings-grid">
            <Card>
              <div className="section-head"><h2>Identity & connection</h2><Badge status={state.connection?.status ?? "NOT CONNECTED"} /></div>
              <dl className="settings-list">
                <div><dt>Local identity</dt><dd>{state.user.email}</dd></div>
                <div><dt>Paybox provider</dt><dd>{state.mode === "mock" ? "Mock Paybox" : "Real Paybox"}</dd></div>
                <div><dt>Selected credential</dt><dd><Address>{state.connection?.selectedCredentialId}</Address></dd></div>
                <div><dt>Wallet</dt><dd>{state.connection?.selectedWalletName ?? "Not selected"}<br /><Address>{state.connection?.selectedWalletAddress}</Address></dd></div>
                <div><dt>Approval mode</dt><dd>{state.connection?.approvalMode?.replaceAll("_", " ") ?? "Not configured"}</dd></div>
              </dl>
            </Card>
            <Card>
              <div className="section-head"><h2>Fixed safety policy</h2><Badge status={state.automation?.status ?? "SETUP REQUIRED"} /></div>
              <dl className="settings-list">
                <div><dt>Purchase</dt><dd>Exactly 1 USDC → cbBTC</dd></div>
                <div><dt>Schedule</dt><dd>Every five minutes · UTC</dd></div>
                <div><dt>Per execution</dt><dd>$1 maximum</dd></div>
                <div><dt>Rolling 24 hours</dt><dd>$12 maximum</dd></div>
                <div><dt>Lifetime</dt><dd>$25 maximum</dd></div>
                <div><dt>Expiration</dt><dd>{state.automation?.expiresAt ? new Date(state.automation.expiresAt).toLocaleString() : "Starts on activation"}</dd></div>
              </dl>
            </Card>
          </div>
          <Card className="danger-zone">
            <div><p className="eyebrow">Emergency controls</p><h2>Stop or reset</h2><p>Revoking preserves the audit log. Resetting deletes all local demo records.</p></div>
            <div className="button-row">
              <Button variant="danger" onClick={() => action.mutate({ action: "revoke" })}><ShieldOff size={16} /> Revoke wallet access</Button>
              <Button variant="secondary" onClick={() => action.mutate({ action: "reset" })}><RotateCcw size={16} /> Reset demo data</Button>
            </div>
          </Card>
          {state.mode === "real" && (
            <div className="real-banner"><AlertTriangle size={18} /> Real financial execution is {state.realFinancialExecutionEnabled ? "enabled" : "disabled"}.</div>
          )}
        </div>
      )}
    </WithState>
  );
}

"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { WithState } from "@/components/page-state";
import { Address, Badge, Card } from "@/components/ui";

export default function ActivityPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <WithState>
      {(state) => (
        <div className="page">
          <div className="page-heading split">
            <div><p className="eyebrow">Immutable local record</p><h1>Activity</h1><p>Successful, pending, blocked, skipped, and failed executions.</p></div>
            <span className="record-count">{state.executions.length} events</span>
          </div>
          <Card className="activity-card">
            <div className="activity-head">
              <span>Time</span><span>Trigger</span><span>Status</span><span>Amount</span><span>Request</span><span />
            </div>
            {state.executions.length === 0 && <div className="empty-row">No executions yet. Run the test purchase from Wallet setup.</div>}
            {state.executions.map((execution) => (
              <div className="activity-wrap" key={execution.id}>
                <button className="activity-row" onClick={() => setOpenId(openId === execution.id ? null : execution.id)}>
                  <span>{new Date(execution.createdAt).toLocaleString()}</span>
                  <span>{execution.type.replaceAll("_", " ")}</span>
                  <span><Badge status={execution.status} /></span>
                  <span>$1.00</span>
                  <Address>{execution.providerRequestId}</Address>
                  <ChevronDown className={openId === execution.id ? "rotate" : ""} size={16} />
                </button>
                {openId === execution.id && (
                  <div className="execution-detail">
                    <div className="detail-grid">
                      <div><span>Idempotency key</span><code>{execution.idempotencyKey}</code></div>
                      <div><span>Transaction signature</span><Address>{execution.transactionSignature}</Address></div>
                      <div><span>cbBTC received</span><b>{execution.receivedCbbtcAtomic ? (Number(execution.receivedCbbtcAtomic) / 1e8).toFixed(8) : "—"}</b></div>
                      <div><span>Reservation</span><b>{execution.isSpendReserved ? "$1 reserved" : "None"}</b></div>
                    </div>
                    <div className="policy-list">
                      <h3>Policy checks</h3>
                      {execution.policyDecisionJson.checks?.map((check) => (
                        <div key={check.key}>{check.passed ? <Check size={14} /> : <X size={14} />}<span>{check.message}</span></div>
                      ))}
                    </div>
                    <div className="timeline">
                      <h3>State transitions</h3>
                      {execution.transitions.map((transition) => (
                        <div key={transition.id}><i /><span><b>{transition.toStatus.replaceAll("_", " ")}</b><small>{transition.note}</small></span><time>{new Date(transition.createdAt).toLocaleTimeString()}</time></div>
                      ))}
                    </div>
                    {execution.errorMessage && <div className="note-box danger"><strong>Error</strong><p>{execution.errorMessage}</p></div>}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}
    </WithState>
  );
}

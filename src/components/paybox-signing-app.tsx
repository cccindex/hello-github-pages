"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PURCHASE_CONFIG } from "@/lib/constants";

const SANDBOX_URL = "https://five-minute-bitcoin-sandbox.vercel.app/sandbox.html";
const SANDBOX_ORIGIN = "https://five-minute-bitcoin-sandbox.vercel.app";

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
};

export function PayboxSigningApp({
  executionId,
  credentialId,
  toolResult,
  actionInput,
  onRequestChanged,
}: {
  executionId: string;
  credentialId: string;
  toolResult: Record<string, unknown>;
  actionInput?: Record<string, unknown>;
  onRequestChanged: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onRequestChangedRef = useRef(onRequestChanged);
  const [height, setHeight] = useState(720);
  const [error, setError] = useState("");
  const toolInput = useMemo(
    () => actionInput ?? ({
      credential_id: credentialId,
      src_chain: PURCHASE_CONFIG.chain,
      src_token: PURCHASE_CONFIG.sourceToken.mint,
      dst_token: PURCHASE_CONFIG.destinationToken.mint,
      amount: PURCHASE_CONFIG.amountAtomic,
      swap_direction: "exact-amount-in",
      slippage_bps: PURCHASE_CONFIG.slippageBps,
      value_cents: PURCHASE_CONFIG.displayAmountCents,
    }),
    [actionInput, credentialId],
  );
  onRequestChangedRef.current = onRequestChanged;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let initialized = false;

    const send = (message: JsonRpcMessage) => {
      iframe.contentWindow?.postMessage(message, SANDBOX_ORIGIN);
    };

    const respond = (
      id: string | number,
      result?: unknown,
      responseError?: { code: number; message: string },
    ) => {
      send({
        jsonrpc: "2.0",
        id,
        ...(responseError ? { error: responseError } : { result: result ?? {} }),
      });
    };

    const listener = async (event: MessageEvent<JsonRpcMessage>) => {
      if (event.source !== iframe.contentWindow || event.origin !== SANDBOX_ORIGIN) return;
      const message = event.data;
      if (message.method === "ui/notifications/sandbox-proxy-ready") {
        try {
          const response = await fetch("/api/paybox/app-resource", { cache: "no-store" });
          const resource = await response.json();
          if (!response.ok) throw new Error(resource.error ?? "Could not load Paybox signing app.");
          send({
            jsonrpc: "2.0",
            method: "ui/notifications/sandbox-resource-ready",
            params: resource,
          });
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not load Paybox signing app.");
        }
        return;
      }

      if (message.method === "ui/initialize" && message.id !== undefined) {
        const protocolVersion =
          typeof message.params?.protocolVersion === "string"
            ? message.params.protocolVersion
            : "2026-01-26";
        respond(message.id, {
          protocolVersion,
          hostInfo: { name: "Five Minute Bitcoin", version: "0.1.0" },
          hostCapabilities: {
            openLinks: {},
            serverTools: {},
          },
          hostContext: {
            theme: "light",
            platform: "web",
            displayMode: "inline",
            availableDisplayModes: ["inline"],
            containerDimensions: { width: iframe.clientWidth, maxHeight: 1200 },
            locale: navigator.language,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
        return;
      }

      if (message.method === "ui/notifications/initialized" && !initialized) {
        initialized = true;
        send({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-input",
          params: { arguments: toolInput },
        });
        send({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: toolResult,
        });
        return;
      }

      if (message.method === "ui/notifications/size-changed") {
        const requested = Number(message.params?.height);
        if (Number.isFinite(requested)) setHeight(Math.min(1200, Math.max(420, requested)));
        return;
      }

      if (message.method === "ui/open-link" && message.id !== undefined) {
        const url = message.params?.url;
        if (typeof url === "string" && url.startsWith("https://")) {
          window.open(url, "_blank", "noopener,noreferrer");
          respond(message.id);
        } else {
          respond(message.id, undefined, { code: -32602, message: "Invalid link." });
        }
        return;
      }

      if (message.method === "tools/call" && message.id !== undefined) {
        try {
          const name = message.params?.name;
          const args = message.params?.arguments;
          if (typeof name !== "string" || !args || typeof args !== "object") {
            throw new Error("Invalid Paybox tool call.");
          }
          const response = await fetch("/api/paybox/app-call", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ executionId, name, arguments: args }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Paybox signing call failed.");
          respond(message.id, result);
          if (["submit_envelopes", "submit_signature", "moonx_sign"].includes(name)) {
            window.setTimeout(() => onRequestChangedRef.current(), 1500);
          }
        } catch (caught) {
          const messageText =
            caught instanceof Error ? caught.message : "Paybox signing call failed.";
          setError(messageText);
          respond(message.id, undefined, { code: -32000, message: messageText });
        }
        return;
      }

      if (message.id !== undefined && message.method === "ping") {
        respond(message.id);
        return;
      }
      if (message.id !== undefined && message.method === "ui/request-display-mode") {
        respond(message.id, { mode: "inline" });
      }
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [executionId, toolInput, toolResult]);

  return (
    <div className="paybox-signing-host">
      {error && <div className="note-box danger"><strong>Paybox signing error</strong><p>{error}</p></div>}
      <iframe
        ref={iframeRef}
        src={SANDBOX_URL}
        title="Paybox signing window"
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{ height }}
      />
    </div>
  );
}

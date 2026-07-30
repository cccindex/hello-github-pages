"use client";

import { AlertTriangle, LoaderCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  getApiBaseUrl,
  saveApiBaseUrl,
  useProductAction,
  useProductState,
} from "@/lib/client-state";
import { Button } from "@/components/ui";

export function WithState({
  children,
}: {
  children: (
    state: NonNullable<ReturnType<typeof useProductState>["data"]>,
    action: ReturnType<typeof useProductAction>,
  ) => ReactNode;
}) {
  const query = useProductState();
  const action = useProductAction();
  const [backendUrl, setBackendUrl] = useState(() => getApiBaseUrl());
  if (query.isLoading) {
    return <div className="center-state"><LoaderCircle className="spin" /> Loading local data…</div>;
  }
  if (query.error || !query.data) {
    return (
      <div className="center-state backend-setup">
        <AlertTriangle />
        <strong>Connect this page to your computer</strong>
        <span>
          Start the local backend and its HTTPS tunnel, then paste the tunnel
          address below. It is saved only in this browser.
        </span>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveApiBaseUrl(backendUrl);
            window.location.reload();
          }}
        >
          <input
            aria-label="Local backend tunnel URL"
            placeholder="https://example.trycloudflare.com"
            type="url"
            value={backendUrl}
            onChange={(event) => setBackendUrl(event.target.value)}
            required
          />
          <Button type="submit">Connect backend</Button>
        </form>
        <small>{query.error?.message ?? "Backend unavailable."}</small>
      </div>
    );
  }
  return (
    <>
      {action.error && <div className="toast error">{action.error.message}</div>}
      {children(query.data, action)}
    </>
  );
}

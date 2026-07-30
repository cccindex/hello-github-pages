"use client";

import { AlertTriangle, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useProductAction, useProductState } from "@/lib/client-state";

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
  if (query.isLoading) {
    return <div className="center-state"><LoaderCircle className="spin" /> Loading local data…</div>;
  }
  if (query.error || !query.data) {
    return (
      <div className="center-state error">
        <AlertTriangle />
        <strong>Local database is unavailable</strong>
        <span>{query.error?.message ?? "Start PostgreSQL and refresh."}</span>
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

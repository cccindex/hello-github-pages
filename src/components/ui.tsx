import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "quiet";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({ status }: { status: string }) {
  const tone =
    ["ACTIVE", "SUCCESS", "CONNECTED", "READY"].includes(status)
      ? "success"
      : ["FAILED", "ERROR", "BLOCKED", "REVOKED", "DENIED"].includes(status)
        ? "danger"
        : ["PAUSED", "PENDING_USER_APPROVAL", "TEST_REQUIRED"].includes(status)
          ? "warning"
          : "neutral";
  return <span className={`badge badge-${tone}`}>{status.replaceAll("_", " ")}</span>;
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function Address({ children }: { children: string | null | undefined }) {
  if (!children) return <span className="muted">Not selected</span>;
  return (
    <code title={children}>
      {children.length > 18 ? `${children.slice(0, 7)}…${children.slice(-6)}` : children}
    </code>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/application/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
  /**
   * Optional label override. When provided, the content replaces the
   * formatted `status` text while the token-derived color variant still
   * comes from `status` — lets callers compose richer labels (e.g. KPI
   * counts) without redefining the variant styles.
   */
  children?: ReactNode;
}

type BadgeVariant = "success" | "warn" | "accent" | "danger" | "default";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-success/10 text-success border-success",
  warn: "bg-warn/10 text-warn border-warn",
  accent: "bg-accent/10 text-accent border-accent",
  danger: "bg-danger/10 text-danger border-danger",
  default: "bg-surface-warm text-muted border-border",
};

function resolveVariant(status: string): BadgeVariant {
  const normalized = status.toLowerCase();

  if (
    normalized === "active" ||
    normalized === "completed" ||
    normalized === "approved" ||
    normalized === "success" ||
    normalized === "enabled"
  ) {
    return "success";
  }

  if (
    normalized === "awaiting_hitl" ||
    normalized === "awaiting review" ||
    normalized === "pending" ||
    normalized === "waiting" ||
    normalized === "warn"
  ) {
    return "warn";
  }

  if (
    normalized === "streaming" ||
    normalized === "in_progress" ||
    normalized === "in progress" ||
    normalized === "processing" ||
    normalized === "accent"
  ) {
    return "accent";
  }

  if (
    normalized === "rejected" ||
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "danger"
  ) {
    return "danger";
  }

  return "default";
}

function formatLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function StatusBadge({ status, className, children }: Readonly<StatusBadgeProps>) {
  const variant = resolveVariant(status);

  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-mono text-xs uppercase tracking-[0.1em] select-none rounded-none",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children ?? formatLabel(status)}
    </span>
  );
}

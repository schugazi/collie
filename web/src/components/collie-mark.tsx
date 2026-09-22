import type { CSSProperties } from "react";

import logo from "@/assets/remote-logo.png";
import { cn } from "@/lib/utils";

export interface CollieMarkProps {
  size?: number;
  loading?: boolean;
  paper?: string;
  title?: string;
  className?: string;
  weight?: "full" | "header";
}

// Preserve the shared contract so loading, idle and navigation surfaces all use this art.
export function CollieMark({ size = 32, loading = false, paper, title, className }: CollieMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 192 192"
      role={title === undefined ? "presentation" : "img"}
      aria-label={title}
      className={cn(loading && "cm-live", className)}
      // SAFETY: these are CSS custom properties passed verbatim to the inline stylesheet.
      style={{ display: "block", flex: "none", "--cm-paper": paper,
        "--cm-a1": loading ? "#40bfc5" : "transparent" } as CSSProperties}
    >
      <style>{`
        .cm-live .cm-indicator { animation: cm-pulse 1.8s ease-in-out infinite; }
        @keyframes cm-pulse { 50% { opacity: .35; } }
        @media (prefers-reduced-motion: reduce) { .cm-indicator { animation: none !important; } }
      `}</style>
      <image href={logo} width="192" height="192" />
      <rect className="cm-indicator" x="3" y="3" width="186" height="186"
        rx="8" fill="none" stroke="var(--cm-a1)" strokeWidth="6" />
    </svg>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "confirm" | "reject" | "cyan";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-[var(--color-gold)] hover:bg-[var(--color-gold-strong)] text-[#1a1204] font-bold shadow-sm",
  cyan: "bg-[var(--color-cyan)] hover:bg-[var(--color-cyan-strong)] text-[#04201e] font-bold shadow-sm",
  secondary:
    "bg-[var(--color-surface-raised)] hover:bg-[var(--color-border-strong)] text-[var(--color-text)] border border-[var(--color-border-strong)]",
  danger: "bg-[var(--color-danger)] hover:brightness-110 text-white",
  ghost: "bg-transparent hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]",
  confirm: "bg-[var(--color-success)] hover:brightness-110 text-[#04210f] font-bold",
  reject: "bg-transparent hover:bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger)]/40",
};

export function Button({
  variant = "primary",
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        ${fullWidth ? "w-full" : ""} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "confirm" | "reject";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-[var(--color-primary)] hover:bg-[var(--color-primary-strong)] text-white shadow-sm shadow-blue-900/30",
  secondary:
    "bg-[var(--color-surface-raised)] hover:bg-[var(--color-border-strong)] text-[var(--color-text)] border border-[var(--color-border-strong)]",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  ghost: "bg-transparent hover:bg-white/5 text-[var(--color-text-muted)]",
  confirm: "bg-emerald-600 hover:bg-emerald-700 text-white",
  reject: "bg-transparent hover:bg-red-950/40 text-red-400 border border-red-900/60",
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

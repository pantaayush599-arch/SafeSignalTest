import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme, type ThemeMode } from "../state/theme";

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Laptop },
];

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  return (
    <div
      className="inline-flex rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-1"
      role="radiogroup"
      aria-label="Theme"
    >
      {OPTIONS.map(({ mode: m, label, icon: Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => setMode(m)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === m ? "bg-[var(--color-gold)] text-[#1a1204]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

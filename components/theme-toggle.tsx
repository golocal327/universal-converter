"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "system", icon: SunMoon, label: "System theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // next-themes resolves the real theme from localStorage via a script that
  // runs BEFORE React hydrates, so the client's first render already knows
  // the true theme while the server-rendered HTML never can — a genuine,
  // unavoidable divergence. Deferring the "which button is active" state to
  // after mount (matching next-themes' own documented pattern) is the fix.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center rounded-full border border-border bg-surface p-0.5" role="group" aria-label="Theme">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={mounted && theme === value}
          onClick={() => setTheme(value)}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            mounted && theme === value ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

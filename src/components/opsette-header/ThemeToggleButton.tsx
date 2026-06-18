import React from "react";
import { useTheme } from "@/hooks/use-theme";

/**
 * ThemeToggleButton — sun/moon button that flips the app between light and
 * dark. Reads/writes the same module-level theme state as `useTheme()` so
 * every consumer (header, this button, the rest of the app) stays in sync.
 *
 * Drop into <OpsetteHeader rightExtra={<ThemeToggleButton />} />.
 *
 * Spec: c:\Opsette Tools\HEADER_BAR.md
 */
export function ThemeToggleButton(): React.ReactElement {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card text-foreground transition-all active:scale-95 hover:opacity-80"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" /><path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" /><path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

export default ThemeToggleButton;

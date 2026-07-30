"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "bubblegum" | "shadow";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "bubblegum",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("bubblegum");

  useEffect(() => {
    const stored = window.localStorage.getItem("kairos-theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("kairos-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "bubblegum" ? "shadow" : "bubblegum"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

import { useEffect, useState } from "react";

const KEY = "sceneiq-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(KEY) as "dark" | "light") || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
  };
}

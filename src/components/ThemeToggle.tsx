"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check initial theme from document class
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="h-10 w-10 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-primary transition-all active:scale-95 shrink-0"
      title={theme === "light" ? "Mudar para Modo Escuro" : "Mudar para Modo Claro"}
      aria-label="Alternar Tema"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 text-slate-600 dark:text-slate-300 animate-in spin-in-45 duration-300" />
      ) : (
        <Sun className="h-5 w-5 text-amber-400 animate-in spin-in-45 duration-300" />
      )}
    </button>
  );
}

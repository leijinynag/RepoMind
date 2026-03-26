import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",

      setMode: (mode) => {
        set({ mode });
        applyThemeToDOM(mode);
      },

      toggleMode: () => {
        const newMode = get().mode === "dark" ? "light" : "dark";
        set({ mode: newMode });
        applyThemeToDOM(newMode);
      },
    }),
    {
      name: "github-agent-theme",
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            applyThemeToDOM(state.mode);
          }
        };
      },
    },
  ),
);

function applyThemeToDOM(mode: ThemeMode) {
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

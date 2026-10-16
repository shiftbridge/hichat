"use client";
import { useEffect } from "react";
import { useBrowserState } from "@/lib/browser-storage";
import { builtInThemes, parseTheme, themeProperties } from "@/lib/themes";

export function ThemeController() {
  const { preferences, customTheme } = useBrowserState();
  useEffect(() => {
    const controller = new AbortController();
    async function apply() {
      try {
        const theme =
          builtInThemes.find((theme) => theme.id === preferences.theme) ||
          builtInThemes[0];
        const css =
          preferences.theme === "custom" && customTheme
            ? customTheme.css
            : await fetch(theme.file, { signal: controller.signal }).then(
                (response) => {
                  if (!response.ok) throw new Error("Theme unavailable");
                  return response.text();
                },
              );
        if (controller.signal.aborted) return;
        const tokens = parseTheme(css);
        const root = document.documentElement;
        themeProperties.forEach((name) => root.style.removeProperty(name));
        Object.entries(tokens).forEach(([name, value]) =>
          root.style.setProperty(name, value),
        );
        root.dataset.theme = preferences.theme;
        const probe = document.createElement("span");
        probe.style.display = "none";
        document.body.appendChild(probe);
        const isLight = (property: string) => {
          probe.style.color = `var(${property})`;
          const rgb = getComputedStyle(probe)
            .color.match(/[\d.]+/g)
            ?.map(Number) || [0, 0, 0];
          const linear = rgb.slice(0, 3).map((value) => {
            const n = value / 255;
            return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
          });
          return (
            linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 > 0.179
          );
        };
        root.style.setProperty(
          "--on-accent",
          isLight("--brand-primary") ? "#111412" : "#ffffff",
        );
        root.style.setProperty(
          "--on-button",
          isLight("--button-primary-fill") ? "#111412" : "#ffffff",
        );
        root.style.colorScheme = isLight("--background-primary")
          ? "light"
          : "dark";
        probe.remove();
      } catch (error) {
        if (!controller.signal.aborted)
          console.error("Unable to load theme", error);
      }
    }
    void apply();
    return () => controller.abort();
  }, [preferences.theme, customTheme]);
  return null;
}

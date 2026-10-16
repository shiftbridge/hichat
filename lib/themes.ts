export const themeProperties = [
  "--brand-primary",
  "--brand-secondary",
  "--brand-primary-light",
  "--background-primary",
  "--background-secondary",
  "--background-secondary-alt",
  "--background-tertiary",
  "--background-textarea",
  "--background-header-primary",
  "--background-header-secondary",
  "--background-header-primary-hover",
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--text-chat",
  "--text-link",
  "--status-online",
  "--status-idle",
  "--status-dnd",
  "--status-offline",
  "--border-color",
  "--button-primary-fill",
  "--button-danger-fill",
  "--font-sans",
  "--font-mono",
] as const;
export type ThemeTokens = Partial<
  Record<(typeof themeProperties)[number], string>
>;
export const builtInThemes = [
  {
    id: "default",
    name: "Grove",
    description: "Charcoal & fresh lime",
    file: "/themes/Grove.css",
    colors: ["#111412", "#d1f78a", "#969f94"],
  },
  {
    id: "nord",
    name: "Nord",
    description: "Cool, calm & collected",
    file: "/themes/Nord.css",
    colors: ["#2e3440", "#88c0d0", "#b48ead"],
  },
  {
    id: "dawn",
    name: "Dawn",
    description: "A little light in your day",
    file: "/themes/Dawn.css",
    colors: ["#faf8f5", "#7952b3", "#c78c51"],
  },
];

// Read only palette/font declarations. Imported selectors, @imports and URLs never run.
export function parseTheme(css: string): ThemeTokens {
  if (css.length > 30000)
    throw new Error("Theme files must be smaller than 30 KB.");
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const root = clean.match(/:root\s*\{([^}]*)\}/);
  if (!root) throw new Error("Use a :root { … } block, like Nord.css.");
  const tokens: ThemeTokens = {};
  for (const declaration of root[1].split(";")) {
    const colon = declaration.indexOf(":");
    const name = declaration.slice(0, colon).trim() as keyof ThemeTokens;
    const value = declaration.slice(colon + 1).trim();
    if (!themeProperties.includes(name) || !value) continue;
    const font = name === "--font-sans" || name === "--font-mono";
    if (
      font
        ? !/^[\w\s,"'\-]+$/.test(value)
        : !/^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}([0-9a-f]{2})?$|^(rgb|rgba|hsl|hsla)\([\d\s.,%+\-/]+\)$/i.test(
            value,
          )
    )
      throw new Error(
        `Use a color value for ${name}, or a font list for font variables.`,
      );
    tokens[name] = value;
  }
  for (const name of [
    "--brand-primary",
    "--background-primary",
    "--text-primary",
  ] as const)
    if (!tokens[name]) throw new Error(`Your theme needs ${name}.`);
  return tokens;
}

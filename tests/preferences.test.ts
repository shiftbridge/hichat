import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseTheme, builtInThemes } from "@/lib/themes";
import {
  appendHistory,
  rememberRoom,
  resetBrowserData,
  sanitizePreferences,
  trimHistories,
  saveCustomTheme,
  HISTORY_KEY,
  CUSTOM_THEME_KEY,
  PREFERENCE_COOKIE,
} from "@/lib/browser-storage";
import type { Message } from "@/types/chat";

const message = (id: number, room = "general"): Message => ({
  id: String(id),
  room,
  user: "Alex",
  text: `Hello ${id}`,
  timestamp: new Date(id * 1000).toISOString(),
});

describe("themes and saved conversations", () => {
  test("loads Nord.css and each supplied theme using the same variable format", () => {
    expect(
      parseTheme(readFileSync("Nord.css", "utf8"))["--brand-primary"],
    ).toBe("#88C0D0");
    for (const theme of builtInThemes)
      expect(
        parseTheme(readFileSync(`public${theme.file}`, "utf8"))[
          "--background-primary"
        ],
      ).toBeDefined();
  });
  test("rejects invalid themes and does not execute imported CSS rules", () => {
    expect(() => parseTheme("body { color: red; }")).toThrow();
    expect(() =>
      parseTheme(":root { --brand-primary: url(https://example.com); }"),
    ).toThrow();
    expect(() => parseTheme(":root { --brand-primary: #fff; }")).toThrow();
    const tokens = parseTheme(
      "@import url(https://example.com); :root { --brand-primary: #fff; --background-primary: #111; --text-primary: #fff; --unknown: red; } body { display: none; }",
    );
    expect(Object.keys(tokens).length).toBe(3);
  });
  test("caps room and message history while dropping unsafe restored image links", () => {
    const messages = Array.from({ length: 140 }, (_, index) => message(index));
    const history = trimHistories({
      general: [
        ...messages,
        {
          ...message(999),
          image: {
            id: "image.png",
            name: "image",
            data: "javascript:alert(1)",
          },
        },
      ],
    });
    expect(history.general.length).toBe(100);
    expect(history.general[0].id).toBe("40");
    expect(history.general.at(-1)?.id).toBe("139");
    const manyRooms = Object.fromEntries(
      Array.from({ length: 15 }, (_, index) => [
        `room${index}`,
        [message(index, `room${index}`)],
      ]),
    );
    expect(Object.keys(trimHistories(manyRooms)).length).toBe(10);
    const proto = trimHistories(
      JSON.parse(JSON.stringify({ ["__proto__"]: [message(1, "__proto__")] })),
    );
    expect(proto["__proto__"][0].text).toBe("Hello 1");
  });
  test("bounds image history without mutating the messages being displayed", () => {
    const images = Array.from({ length: 10 }, (_, index) => ({
      ...message(index),
      image: {
        id: "image.png",
        name: "image",
        data: "data:image/png;base64," + "a".repeat(300000),
      },
    }));
    const histories = trimHistories({ general: images });
    expect(JSON.stringify(histories).length).toBeLessThanOrEqual(1500000);
    expect(images.length).toBe(10);
    expect(histories.general.at(-1)?.id).toBe("9");
  });
  test("sanitizes remembered preferences and duplicate recent rooms", () => {
    expect(
      sanitizePreferences({
        username: " Alex ",
        room: "../bad",
        rooms: ["general", "general", "design", "bad room"],
        theme: "unknown",
      }),
    ).toEqual({
      username: "Alex",
      room: "general",
      rooms: ["general", "design"],
      theme: "default",
    });
  });
  test("remembers rooms and images, then reset clears HiChat cookies and storage only", () => {
    const cookies = new Map<string, string>([["unrelated", "keep"]]);
    const data = new Map<string, string>([["unrelated", "keep"]]);
    const documentMock = {
      get cookie() {
        return [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
      },
      set cookie(value: string) {
        const [entry] = value.split(";");
        const colon = entry.indexOf("=");
        const name = entry.slice(0, colon);
        if (value.includes("Max-Age=0")) cookies.delete(name);
        else cookies.set(name, entry.slice(colon + 1));
      },
    };
    const storageMock = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size;
      },
    };
    const globals = ["window", "document", "localStorage", "location"] as const;
    const saved = globals.map((name) =>
      Object.getOwnPropertyDescriptor(globalThis, name),
    );
    try {
      Object.defineProperties(globalThis, {
        window: { value: {}, configurable: true },
        document: { value: documentMock, configurable: true },
        localStorage: { value: storageMock, configurable: true },
        location: { value: { protocol: "https:" }, configurable: true },
      });
      rememberRoom("Alex", "general");
      rememberRoom("Alex", "design");
      rememberRoom("Alex", "general");
      const preferences = JSON.parse(
        decodeURIComponent(cookies.get(PREFERENCE_COOKIE)!),
      );
      expect(preferences.username).toBe("Alex");
      expect(preferences.rooms).toEqual(["general", "design"]);
      appendHistory({
        ...message(1),
        image: {
          id: "image.png",
          name: "image",
          data: "data:image/png;base64,aaaa",
        },
      });
      appendHistory(message(1));
      expect(JSON.parse(data.get(HISTORY_KEY)!).general.length).toBe(1);
      saveCustomTheme("Nord", readFileSync("Nord.css", "utf8"));
      expect(data.has(CUSTOM_THEME_KEY)).toBe(true);
      resetBrowserData();
      expect(cookies.has(PREFERENCE_COOKIE)).toBe(false);
      expect(data.has(HISTORY_KEY)).toBe(false);
      expect(data.has(CUSTOM_THEME_KEY)).toBe(false);
      expect(cookies.get("unrelated")).toBe("keep");
      expect(data.get("unrelated")).toBe("keep");
    } finally {
      globals.forEach((name, index) => {
        const descriptor = saved[index];
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
  });
});

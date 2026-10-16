"use client";

import { useSyncExternalStore } from "react";
import type { Message } from "@/types/chat";
import { validImageData } from "@/lib/image-transfer";
import { parseTheme } from "@/lib/themes";

export const PREFERENCE_COOKIE = "hichat_preferences";
export const HISTORY_KEY = "hichat_history";
export const CUSTOM_THEME_KEY = "hichat_custom_theme";
const MAX_HISTORY_LENGTH = 1500000;
export interface Preferences {
  username: string;
  room: string;
  rooms: string[];
  theme: string;
}
interface BrowserState {
  preferences: Preferences;
  histories: Record<string, Message[]>;
  customTheme: { name: string; css: string } | null;
  warning: string;
}
const defaults: Preferences = {
  username: "",
  room: "general",
  rooms: [],
  theme: "default",
};
const empty: BrowserState = {
  preferences: defaults,
  histories: Object.create(null),
  customTheme: null,
  warning: "",
};
let state = empty;
let initialized = false;
const listeners = new Set<() => void>();
const validRoom = (room: unknown): room is string =>
  typeof room === "string" && /^[a-z0-9_-]{1,20}$/.test(room);
export function sanitizePreferences(
  value: Partial<Preferences> | null,
): Preferences {
  return {
    username:
      typeof value?.username === "string"
        ? value.username.trim().slice(0, 15)
        : "",
    room: validRoom(value?.room) ? value.room : "general",
    rooms: Array.isArray(value?.rooms)
      ? [...new Set(value.rooms.filter(validRoom))].slice(0, 10)
      : [],
    theme: ["default", "nord", "dawn", "custom"].includes(value?.theme || "")
      ? value!.theme!
      : "default",
  };
}
function validMessage(value: Message, room: string) {
  return (
    value &&
    typeof value.id === "string" &&
    value.id.length <= 64 &&
    value.room === room &&
    typeof value.user === "string" &&
    value.user.length <= 15 &&
    typeof value.text === "string" &&
    value.text.length <= 2000 &&
    typeof value.timestamp === "string" &&
    (!value.image ||
      (typeof value.image.id === "string" &&
        /^[\w.-]{1,64}$/.test(value.image.id) &&
        typeof value.image.name === "string" &&
        value.image.name.length <= 120 &&
        (value.image.data === undefined || validImageData(value.image.data))))
  );
}
export function trimHistories(histories: Record<string, Message[]>) {
  const result: Record<string, Message[]> = Object.create(null);
  for (const [room, messages] of Object.entries(histories).slice(-10))
    if (validRoom(room) && Array.isArray(messages))
      result[room] = messages
        .filter((message) => validMessage(message, room))
        .slice(-100);
  while (JSON.stringify(result).length > MAX_HISTORY_LENGTH) {
    const oldest = Object.keys(result)
      .filter((room) => result[room].length)
      .sort(
        (a, b) =>
          (Date.parse(result[a][0].timestamp) || 0) -
          (Date.parse(result[b][0].timestamp) || 0),
      )[0];
    if (!oldest) break;
    result[oldest].shift();
  }
  return result;
}
function emit() {
  listeners.forEach((listener) => listener());
}
function getSnapshot(): BrowserState {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    state = { ...empty };
    try {
      const cookie = document.cookie
        .split("; ")
        .find((item) => item.startsWith(`${PREFERENCE_COOKIE}=`));
      if (cookie)
        state.preferences = sanitizePreferences(
          JSON.parse(
            decodeURIComponent(cookie.slice(PREFERENCE_COOKIE.length + 1)),
          ),
        );
    } catch {
      /* Ignore old or malformed preferences. */
    }
    try {
      const history = localStorage.getItem(HISTORY_KEY);
      if (history) {
        const parsed = JSON.parse(history);
        if (parsed && typeof parsed === "object")
          state.histories = trimHistories(parsed);
      }
      const custom = JSON.parse(
        localStorage.getItem(CUSTOM_THEME_KEY) || "null",
      );
      if (
        custom &&
        typeof custom.name === "string" &&
        typeof custom.css === "string"
      ) {
        parseTheme(custom.css);
        state.customTheme = { name: custom.name.slice(0, 40), css: custom.css };
      }
    } catch {
      state.warning =
        "Some saved data could not be loaded. Browser storage may be blocked.";
    }
    if (state.preferences.theme === "custom" && !state.customTheme)
      state.preferences = { ...state.preferences, theme: "default" };
  }
  return state;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === "hichat_preferences_changed" ||
      event.key === HISTORY_KEY ||
      event.key === CUSTOM_THEME_KEY ||
      event.key === null
    ) {
      initialized = false;
      getSnapshot();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
export function useBrowserState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => empty);
}
export function savePreferences(update: Partial<Preferences>) {
  const current = getSnapshot();
  const preferences = sanitizePreferences({
    ...current.preferences,
    ...update,
  });
  state = { ...current, preferences };
  try {
    document.cookie = `${PREFERENCE_COOKIE}=${encodeURIComponent(JSON.stringify(preferences))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (
      !document.cookie
        .split("; ")
        .some((cookie) => cookie.startsWith(`${PREFERENCE_COOKIE}=`))
    )
      state.warning =
        "Cookies are blocked. Your name, rooms and theme may not be remembered.";
    // Notify other tabs without duplicating preference contents in storage.
    localStorage.setItem("hichat_preferences_changed", String(Date.now()));
  } catch {
    state.warning =
      "Browser storage is blocked. Your preferences may not be remembered.";
  }
  emit();
}
export function rememberRoom(username: string, room: string) {
  const { preferences } = getSnapshot();
  if (!validRoom(room)) return;
  savePreferences({
    username,
    room,
    rooms: [room, ...preferences.rooms.filter((name) => name !== room)].slice(
      0,
      10,
    ),
  });
}
export function appendHistory(message: Message) {
  const current = getSnapshot();
  if (!validRoom(message.room) || !validMessage(message, message.room)) return;
  const previous = Object.hasOwn(current.histories, message.room)
    ? current.histories[message.room]
    : [];
  if (previous.some((item) => item.id === message.id)) return;
  const histories = trimHistories({
    ...Object.fromEntries(
      Object.entries(current.histories).filter(
        ([room]) => room !== message.room,
      ),
    ),
    [message.room]: [...previous, message],
  });
  state = { ...current, histories };
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));
  } catch {
    state.warning =
      "Chat history could not be saved. Browser storage is full or blocked.";
  }
  emit();
}
export function saveCustomTheme(name: string, css: string) {
  parseTheme(css);
  state = { ...getSnapshot(), customTheme: { name: name.slice(0, 40), css } };
  try {
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(state.customTheme));
  } catch {
    state.warning =
      "The theme works for this session, but browser storage is unavailable.";
  }
  savePreferences({ theme: "custom" });
}
export function resetBrowserData() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (name.startsWith("hichat_"))
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key?.startsWith("hichat_")) localStorage.removeItem(key);
  }
  state = { ...empty };
  initialized = true;
  emit();
}

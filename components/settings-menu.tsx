"use client";
import { useId, useRef, useState } from "react";
import {
  resetBrowserData,
  saveCustomTheme,
  savePreferences,
  useBrowserState,
} from "@/lib/browser-storage";
import { builtInThemes } from "@/lib/themes";

export function SettingsMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const heading = useId();
  const { preferences, customTheme, warning, histories } = useBrowserState();
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const messageCount = Object.values(histories).reduce(
    (sum, messages) => sum + messages.length,
    0,
  );
  return (
    <>
      <button
        className="settings-trigger subtle"
        type="button"
        aria-label="Open settings"
        title="Settings"
        onClick={() => {
          setConfirmReset(false);
          dialog.current?.showModal();
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="3" fill="var(--panel)" />
          <circle cx="15" cy="17" r="3" fill="var(--panel)" />
        </svg>
      </button>
      <dialog
        className="settings-dialog"
        ref={dialog}
        aria-labelledby={heading}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="settings-content">
          <header className="settings-heading">
            <div>
              <span className="eyebrow">MAKE IT YOURS</span>
              <h2 id={heading}>Settings</h2>
            </div>
            <button
              className="subtle"
              aria-label="Close settings"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <section>
            <h3>Appearance</h3>
            <p>A familiar space, in your favorite colors.</p>
            <div className="theme-options">
              {builtInThemes.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-option ${preferences.theme === theme.id ? "selected" : ""}`}
                  aria-pressed={preferences.theme === theme.id}
                  onClick={() => savePreferences({ theme: theme.id })}
                >
                  <span className="theme-swatches">
                    {theme.colors.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <strong>
                    {theme.name}
                    <span>{preferences.theme === theme.id ? "✓" : ""}</span>
                  </strong>
                  <small>{theme.description}</small>
                </button>
              ))}
              {customTheme && (
                <button
                  className={`theme-option ${preferences.theme === "custom" ? "selected" : ""}`}
                  aria-pressed={preferences.theme === "custom"}
                  onClick={() => savePreferences({ theme: "custom" })}
                >
                  <span className="theme-custom-symbol">✦</span>
                  <strong>
                    {customTheme.name}
                    <span>{preferences.theme === "custom" ? "✓" : ""}</span>
                  </strong>
                  <small>Your imported CSS theme</small>
                </button>
              )}
            </div>
            <input
              ref={file}
              type="file"
              accept=".css,text/css"
              hidden
              aria-label="Import CSS theme"
              onChange={async (event) => {
                const selected = event.target.files?.[0];
                event.target.value = "";
                if (!selected) return;
                try {
                  if (selected.size > 30000)
                    throw new Error("Choose a theme smaller than 30 KB.");
                  saveCustomTheme(
                    selected.name.replace(/\.css$/i, ""),
                    await selected.text(),
                  );
                  setError("");
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Unable to import theme.",
                  );
                }
              }}
            />
            <div className="theme-import-row">
              <button className="subtle" onClick={() => file.current?.click()}>
                ＋ Import .css theme
              </button>
              <a href="/themes/Nord.css" download="Nord.css">
                Download Nord template ↗
              </a>
            </div>
            <p className="settings-hint">
              Use Nord.css’s :root variables. Colors and fonts are applied
              locally.
            </p>
          </section>
          <section className="settings-storage">
            <h3>Remembered on this device</h3>
            <p>
              Your name, last room, recent rooms and theme use cookies. Chat
              history and imported themes use browser storage.
            </p>
            <div className="storage-summary">
              <span>{preferences.rooms.length} recent rooms</span>
              <span>{messageCount} saved messages</span>
            </div>
            <p className="settings-hint">
              Up to 100 messages per room across 10 rooms, within a local size
              limit. Oldest messages are removed as storage fills. History is
              private to this browser, not synced between devices.
            </p>
          </section>
          {(warning || error) && (
            <div className="alert" role="alert">
              {error || warning}
            </div>
          )}
          <section className="settings-reset">
            <h3>A fresh start</h3>
            <p>
              Clear HiChat cookies, chat history, recent rooms and custom
              themes. You’ll return to the home screen.
            </p>
            {confirmReset ? (
              <div className="reset-confirm">
                <strong>Clear all saved HiChat data on this device?</strong>
                <div>
                  <button
                    className="danger-button"
                    onClick={() => {
                      try {
                        resetBrowserData();
                        window.location.assign("/");
                      } catch {
                        setError(
                          "Your browser blocked clearing storage. Clear this site’s data in browser settings.",
                        );
                      }
                    }}
                  >
                    Clear saved data
                  </button>
                  <button
                    className="subtle"
                    onClick={() => setConfirmReset(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="danger-button"
                onClick={() => setConfirmReset(true)}
              >
                Reset HiChat
              </button>
            )}
          </section>
        </div>
      </dialog>
    </>
  );
}

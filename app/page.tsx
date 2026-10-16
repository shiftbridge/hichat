"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { SettingsMenu } from "@/components/settings-menu";
import { rememberRoom, useBrowserState } from "@/lib/browser-storage";

function Entry() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const { preferences } = useBrowserState();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftRoom, setDraftRoom] = useState<string | null>(null);
  return (
    <main className="landing">
      <nav className="brand">
        <span className="brand-icon">
          <BrandMark />
        </span>{" "}
        HiChat <span className="brand-tag">A little closer.</span>
        <SettingsMenu />
      </nav>
      <div className="landing-grid">
        <section className="intro enter">
          <span className="eyebrow">
            <i /> GOOD CONVERSATIONS START HERE
          </span>
          <h1>
            Your people.
            <br />
            Your space.
            <br />
            <span>Just say hi.</span>
          </h1>
          <p>
            A room for every conversation. Drop in, share a thought, and feel a
            little more connected.
          </p>
          <div className="intro-features">
            <span>↗ Instant connection</span>
            <span>◎ No account needed</span>
          </div>
          <div className="conversation-preview" aria-hidden="true">
            <div className="preview-avatar">J</div>
            <div>
              <small>A little hello goes a long way</small>
              <div className="preview-bubble">
                Hey, glad you’re here. <span>✦</span>
              </div>
            </div>
          </div>
        </section>
        <section className="join-card enter">
          <span className="card-symbol">↗</span>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2>Find your conversation.</h2>
          <p>Pick a name and a room. We’ll take you there.</p>
          {(error || params.get("error") === "taken") && (
            <div className="alert" role="alert">
              {error ||
                "That name is already in use in this room. Try another."}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const name = String(data.get("username") || "").trim();
              const room = String(data.get("room") || "")
                .trim()
                .toLowerCase();
              if (!name || !/^[a-z0-9_-]{1,20}$/.test(room)) {
                setError(
                  "Use a name and a room with letters, numbers, hyphens or underscores.",
                );
                return;
              }
              rememberRoom(name, room);
              setJoining(true);
              router.push(
                `/room/${encodeURIComponent(room)}?username=${encodeURIComponent(name)}`,
              );
            }}
          >
            <label htmlFor="username">
              Your name <span>How others will see you</span>
            </label>
            <input
              id="username"
              name="username"
              placeholder="e.g. Alex"
              value={draftName ?? preferences.username}
              onChange={(event) => setDraftName(event.target.value)}
              autoComplete="nickname"
              required
              maxLength={15}
            />
            <label htmlFor="room">
              Room name <span>Join an existing room or start your own</span>
            </label>
            <div className="room-input">
              <span>#</span>
              <input
                id="room"
                name="room"
                value={draftRoom ?? preferences.room}
                onChange={(event) => setDraftRoom(event.target.value)}
                required
                maxLength={20}
                pattern="[a-zA-Z0-9_\-]+"
                autoComplete="off"
              />
            </div>
            <button className="primary" disabled={joining}>
              {joining ? "Opening your room…" : "Let’s talk"}
              <span>↗</span>
            </button>
          </form>
          {preferences.rooms.length > 0 && (
            <div className="recent-rooms">
              <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
              <div>
                {preferences.rooms.map((room) => (
                  <button
                    className="room-chip"
                    key={room}
                    type="button"
                    disabled={joining}
                    onClick={() => {
                      const name = (draftName ?? preferences.username).trim();
                      setDraftRoom(room);
                      if (!name) {
                        document.getElementById("username")?.focus();
                        return;
                      }
                      rememberRoom(name, room);
                      setJoining(true);
                      router.push(
                        `/room/${encodeURIComponent(room)}?username=${encodeURIComponent(name)}`,
                      );
                    }}
                  >
                    # {room}
                    <span>↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="card-foot">
            <span className="status-dot" /> Real-time conversations. Simple as
            that.
          </div>
        </section>
      </div>
      <footer>
        <span>A space to connect, one hello at a time.</span>
        <span>
          Made for the moment <span className="accent">✦</span>
        </span>
      </footer>
    </main>
  );
}
export default function Home() {
  return (
    <Suspense fallback={<main className="loading">Opening HiChat…</main>}>
      <Entry />
    </Suspense>
  );
}

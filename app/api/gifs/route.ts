import { GiphyFetch } from "@giphy/js-fetch-api";
import { NextResponse } from "next/server";
import { normalizeGifs } from "@/lib/gifs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Server-only configuration: none of these values enter client bundles.
  const Config = {
    giphy: process.env.GIPHY_API_KEY,
    klipy: process.env.KLIPY_API_KEY,
  };
  const params = new URL(request.url).searchParams;
  const requested = params.get("provider");
  const provider = requested || (Config.giphy ? "giphy" : "klipy");
  const query = (params.get("q") || "").trim();
  const reply = (body: object, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if ((provider !== "giphy" && provider !== "klipy") || query.length > 100)
    return reply(
      {
        error: "Choose a valid GIF provider and a search under 100 characters.",
      },
      400,
    );
  const key = Config[provider];
  if (!key)
    return reply(
      {
        error: `${provider.toUpperCase()} search is not configured on this server.`,
      },
      503,
    );
  try {
    let body: unknown;
    if (provider === "giphy") {
      const sdk = new GiphyFetch(key);
      const options = {
        limit: 24,
        rating: "pg-13" as const,
        type: "gifs" as const,
      };
      const result = query ? sdk.search(query, options) : sdk.trending(options);
      // The SDK has no AbortSignal option. Bound how long this route waits.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        body = await Promise.race([
          result,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error("GIF request timed out")),
              12000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    } else {
      const endpoint = query ? "search" : "trending";
      const url = new URL(
        `https://api.klipy.com/api/v1/${encodeURIComponent(key)}/gifs/${endpoint}`,
      );
      url.searchParams.set("page", "1");
      url.searchParams.set("per_page", "24");
      url.searchParams.set("content_filter", "medium");
      if (query) url.searchParams.set("q", query);
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
      });
      if (!response.ok)
        return reply(
          {
            error:
              response.status === 429
                ? "GIF search is busy. Try again shortly."
                : "The GIF provider could not complete this search.",
          },
          response.status === 429 ? 429 : 502,
        );
      body = await response.json();
    }
    const results = normalizeGifs(body, provider).filter(
      (gif) => !JSON.stringify(gif).includes(key),
    );
    return reply({ provider, results });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 429
    )
      return reply({ error: "GIF search is busy. Try again shortly." }, 429);
    // Upstream exception messages/URLs can contain credentials. Never return them.
    return reply(
      { error: "Unable to reach the GIF provider. Please try again." },
      502,
    );
  }
}

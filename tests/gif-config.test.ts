import { expect, test, spyOn } from "bun:test";
import { GET } from "@/app/api/gifs/route";

const spyFetch = () =>
  spyOn(
    globalThis as {
      fetch: (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>;
    },
    "fetch",
  );

async function withConfig(run: () => Promise<void>) {
  const previous = [process.env.GIPHY_API_KEY, process.env.KLIPY_API_KEY];
  process.env.GIPHY_API_KEY = "private-giphy-fixture";
  process.env.KLIPY_API_KEY = "private-klipy-fixture";
  try {
    await run();
  } finally {
    for (const [index, name] of ["GIPHY_API_KEY", "KLIPY_API_KEY"].entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
  }
}
test("GIF searches use private Config keys upstream and return media only", async () => {
  await withConfig(async () => {
    let upstream = "";
    const fetchMock = spyFetch().mockImplementation(async (input) => {
      upstream = String(input);
      return Response.json({
        meta: { response_id: "test", status: 200, msg: "OK" },
        data: [
          {
            title: "Cat",
            url: "https://giphy.com/gifs/cat",
            images: {
              fixed_width: { url: "https://media.giphy.com/cat.gif" },
            },
          },
        ],
      });
    });
    try {
      const response = await GET(
        new Request("http://localhost/api/gifs?q=cat"),
      );
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(upstream).toContain("api_key=private-giphy-fixture");
      expect(upstream).toContain("q=cat");
      expect(body).toContain("https://media.giphy.com/cat.gif");
      expect(body).not.toContain("private-giphy-fixture");
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally {
      fetchMock.mockRestore();
    }
  });
});
test("KLIPY uses its private key and becomes the default when GIPHY is unconfigured", async () => {
  await withConfig(async () => {
    delete process.env.GIPHY_API_KEY;
    let upstream = "";
    const fetchMock = spyFetch().mockImplementation(async (input) => {
      upstream = String(input);
      return Response.json({ data: { data: [] } });
    });
    try {
      const response = await GET(new Request("http://localhost/api/gifs"));
      expect(upstream).toContain(
        "api.klipy.com/api/v1/private-klipy-fixture/gifs/trending",
      );
      expect(await response.json()).toEqual({ provider: "klipy", results: [] });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
test("never returns upstream credentials in errors or echoed results", async () => {
  await withConfig(async () => {
    const fetchMock = spyFetch().mockImplementation(async () => {
      throw new Error(
        "Failed URL https://api.giphy.com?api_key=private-giphy-fixture",
      );
    });
    try {
      const response = await GET(new Request("http://localhost/api/gifs"));
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain("private-giphy-fixture");
      fetchMock.mockImplementation(async () =>
        Response.json({
          meta: { response_id: "test", status: 200, msg: "OK" },
          data: [
            {
              title: "private-giphy-fixture",
              url: "https://giphy.com/gifs/cat",
              images: {
                fixed_width: { url: "https://media.giphy.com/cat.gif" },
              },
            },
          ],
        }),
      );
      expect(
        (
          await (
            await GET(
              new Request("http://localhost/api/gifs?q=secret-reflection"),
            )
          ).json()
        ).results,
      ).toEqual([]);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
test("rejects invalid requests and handles missing configuration without fetching", async () => {
  await withConfig(async () => {
    const fetchMock = spyFetch();
    try {
      expect(
        (await GET(new Request("http://localhost/api/gifs?provider=unknown")))
          .status,
      ).toBe(400);
      delete process.env.GIPHY_API_KEY;
      expect(
        (await GET(new Request("http://localhost/api/gifs?provider=giphy")))
          .status,
      ).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });
});

test("GIPHY SDK trending uses the configured limit and rating", async () => {
  await withConfig(async () => {
    process.env.GIPHY_API_KEY = "private-giphy-trending-fixture";
    let upstream = "";
    const fetchMock = spyFetch().mockImplementation(async (input) => {
      upstream = String(input);
      return Response.json({
        meta: { response_id: "trending-test", status: 200 },
        data: [],
      });
    });
    try {
      const response = await GET(
        new Request("http://localhost/api/gifs?provider=giphy"),
      );
      expect(response.status).toBe(200);
      const url = new URL(upstream);
      expect(url.pathname).toBe("/v1/gifs/trending");
      expect(url.searchParams.get("limit")).toBe("24");
      expect(url.searchParams.get("rating")).toBe("pg-13");
    } finally {
      fetchMock.mockRestore();
    }
  });
});

test("GIPHY SDK rate-limit errors return a safe retry response", async () => {
  await withConfig(async () => {
    const fetchMock = spyFetch().mockImplementation(async () =>
      Response.json(
        { meta: { msg: "rate limited private-giphy-fixture" } },
        { status: 429 },
      ),
    );
    try {
      const response = await GET(
        new Request(
          "http://localhost/api/gifs?provider=giphy&q=sdk-rate-limit-test",
        ),
      );
      expect(response.status).toBe(429);
      expect(await response.text()).not.toContain("private-giphy-fixture");
    } finally {
      fetchMock.mockRestore();
    }
  });
});

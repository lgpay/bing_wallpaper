const BING_API =
  "https://www.bing.com/HPImageArchive.aspx?idx=0&n=1&mkt=zh-CN&format=json";

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, ctx);
  }
};

async function handleRequest(request, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), request);

  if (request.method === "GET") {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;
  }

  try {
    const apiResponse = await fetch(BING_API, {
      headers: { Accept: "application/json" }
    });

    if (!apiResponse.ok) {
      return new Response("Bing API request failed", { status: 502 });
    }

    const data = await apiResponse.json();
    const imagePath = data.images?.[0]?.url;

    if (!imagePath) {
      return new Response("Bing image URL not found", { status: 502 });
    }

    const imageUrl = new URL(imagePath, "https://www.bing.com");
    const imageResponse = await fetch(imageUrl.toString());

    if (!imageResponse.ok) {
      return new Response("Bing image request failed", { status: 502 });
    }

    const headers = new Headers(imageResponse.headers);
    headers.set("cache-control", "public, max-age=86400");
    headers.set("access-control-allow-origin", "*");

    const result = new Response(request.method === "HEAD" ? null : imageResponse.body, {
      status: imageResponse.status,
      headers
    });

    if (request.method === "GET") {
      ctx.waitUntil(cache.put(cacheKey, result.clone()));
    }

    return result;
  } catch (error) {
    return new Response("Unable to fetch Bing wallpaper", { status: 502 });
  }
}

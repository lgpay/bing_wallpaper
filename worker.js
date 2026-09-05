const BING_API = "https://www.bing.com/HPImageArchive.aspx?idx=0&n=1&mkt=zh-CN&format=js";
const BING_ORIGIN = "https://www.bing.com";

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, ctx);
  }
};

async function handleRequest(request, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
  try {
    const url = new URL(request.url);
    const wallpaper = await getWallpaper();
    if (url.searchParams.get("api") === "1") {
      return new Response(JSON.stringify(wallpaper), { headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
    }
    if (url.pathname === "/image" || url.searchParams.get("image") === "1") return getImageResponse(request, ctx, wallpaper.imageUrl);
    return new Response(request.method === "HEAD" ? null : renderPage(wallpaper), { headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return new Response("Unable to fetch Bing wallpaper", { status: 502 });
  }
}

async function getWallpaper() {
  const response = await fetch(BING_API, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Bing API request failed");
  const image = (await response.json()).images?.[0];
  if (!image?.url) throw new Error("Bing image URL not found");
  return {
    title: image.title || "Bing 每日壁纸",
    copyright: image.copyright || "",
    copyrightLink: image.copyrightlink || "https://www.bing.com/",
    startDate: image.startdate || "",
    endDate: image.enddate || "",
    imageUrl: new URL(image.url, BING_ORIGIN).toString()
  };
}

async function getImageResponse(request, ctx, imageUrl) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/image", request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return request.method === "HEAD" ? new Response(null, { status: cached.status, headers: cached.headers }) : cached;
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error("Bing image request failed");
  const headers = new Headers(imageResponse.headers);
  headers.set("cache-control", "public, max-age=86400");
  headers.set("access-control-allow-origin", "*");
  const result = new Response(request.method === "HEAD" ? null : imageResponse.body, { status: imageResponse.status, headers });
  if (request.method === "GET") ctx.waitUntil(cache.put(cacheKey, result.clone()));
  return result;
}

function renderPage(wallpaper) {
  const title = escapeHtml(wallpaper.title);
  const copyright = escapeHtml(wallpaper.copyright);
  const date = formatDate(wallpaper.startDate);
  const source = escapeHtml(wallpaper.copyrightLink);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${title} - Bing 每日壁纸"><title>${title} · Bing 每日壁纸</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;color:#fff;background:#101827}.hero{min-height:100vh;display:grid;place-items:end center;padding:28px;position:relative;overflow:hidden}.hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,20,.05) 15%,rgba(5,10,20,.85) 100%),url('/image') center/cover;transform:scale(1.02)}.hero:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 15%,rgba(255,255,255,.16),transparent 42%);pointer-events:none}.content{width:min(100%,1080px);position:relative;z-index:1;padding:34px;border:1px solid rgba(255,255,255,.2);border-radius:24px;background:rgba(9,16,29,.48);box-shadow:0 24px 80px rgba(0,0,0,.32);backdrop-filter:blur(14px)}.eyebrow{margin:0 0 12px;color:#b9d8ff;font-size:.78rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase}h1{margin:0 0 12px;max-width:760px;font-size:clamp(2rem,5vw,4.5rem);line-height:1.06;letter-spacing:-.04em}.copyright{margin:0;max-width:800px;color:rgba(255,255,255,.82);font-size:1rem;line-height:1.7}.meta{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:24px;color:rgba(255,255,255,.7);font-size:.9rem}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}a{color:inherit;text-decoration:none}.button{display:inline-flex;align-items:center;gap:8px;padding:11px 17px;border-radius:999px;background:#fff;color:#111827;font-weight:700;transition:transform .2s,background .2s}.button:hover{transform:translateY(-2px);background:#dcecff}.button.secondary{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.22)}@media(max-width:600px){.hero{padding:14px}.content{padding:24px;border-radius:18px}}
</style></head><body><main class="hero"><footer class="content" style="width:100%;max-width:1100px;padding:10px 16px;border:0;border-radius:10px;background:rgba(5,10,20,.42);box-shadow:none;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap"><span style="color:#c8e1ff;font-size:.76rem;font-weight:700">${title}</span><span style="color:rgba(255,255,255,.7);font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(55vw,560px)">${copyright}</span><span style="color:rgba(255,255,255,.55);font-size:.72rem">${date}</span><a href="/image" download="bing-wallpaper.jpg" style="color:#c8e1ff;font-size:.72rem">下载</a><a href="${source}" target="_blank" rel="noopener" style="color:#c8e1ff;font-size:.72rem">来源</a></footer></main></body></html>`;
}

function formatDate(value) { return /^\d{8}$/.test(value) ? `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}` : "今日"; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

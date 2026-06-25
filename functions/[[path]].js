export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  try {
    // Try serving the exact asset first
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
  } catch {
    // Asset fetch failed, fall through
  }
  // SPA fallback: serve index.html for non-file routes
  return env.ASSETS.fetch(new URL("/index.html", url.origin));
}

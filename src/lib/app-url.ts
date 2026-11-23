export function getAppUrl() {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
      if (["http:", "https:"].includes(url.protocol) && (process.env.NODE_ENV !== "production" || (!isLocalHost && url.protocol === "https:"))) {
        return url.origin;
      }
    } catch {
      // Fall back to the hosting provider URL when APP_URL is invalid.
    }
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return null;
}

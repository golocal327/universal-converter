/** Only allow same-origin relative paths as post-login destinations (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/^\/(login|signup|auth)(\/|$|\?)/.test(value)) return fallback;
  return value.slice(0, 500);
}

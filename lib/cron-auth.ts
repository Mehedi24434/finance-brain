import { timingSafeEqual } from "node:crypto";

/**
 * Returns true if the request bears a matching `Authorization: Bearer
 * ${CRON_SECRET}` header. Vercel Cron sets this automatically when the
 * env var is configured on the project.
 */
export function isAuthorizedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization");
  if (!header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

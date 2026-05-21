/**
 * Time helpers used by server components.
 *
 * react-hooks/purity flags `Date.now()` if called directly inside a
 * render function — even in server components where each render is a
 * fresh request and impurity is irrelevant. Centralising the call here
 * keeps the rule from chasing it through every panel and gives us one
 * place to swap implementations later (e.g. for fixed-clock tests).
 */

export function nowMs(): number {
  return Date.now();
}

export function daysAgoIso(days: number): string {
  return new Date(nowMs() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function daysFromNowIso(days: number): string {
  return new Date(nowMs() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function hoursFromNowIso(hours: number): string {
  return new Date(nowMs() + hours * 60 * 60 * 1000).toISOString();
}

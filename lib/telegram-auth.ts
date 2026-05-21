export function isAuthorizedTelegramUser(fromId: number | undefined | null): boolean {
  if (!fromId) return false;
  const expected = Number(process.env.TELEGRAM_USER_ID);
  if (!Number.isFinite(expected) || expected <= 0) return false;
  return fromId === expected;
}

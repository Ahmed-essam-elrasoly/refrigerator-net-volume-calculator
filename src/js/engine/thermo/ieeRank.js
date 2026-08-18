/**
 * Shared IEE rank thresholds used across the app.
 * Matches the canonical threshold set used by the main comparison logic:
 * A: <= 0.45
 * B: <= 0.55
 * C: <= 0.65
 * D: <= 0.75
 * > 0.75: OUT OF RANKING
 */
export function getIEERank(iee) {
  if (!iee || Number.isNaN(Number(iee))) return 'OUT OF RANKING';
  if (iee <= 0.45) return 'A';
  if (iee <= 0.55) return 'B';
  if (iee <= 0.65) return 'C';
  if (iee <= 0.75) return 'D';
  return 'OUT OF RANKING';
}

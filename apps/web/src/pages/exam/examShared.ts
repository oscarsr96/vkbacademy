// ─── Helpers ──────────────────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 50) return '#f5911e';
  return '#dc2626';
}

export function scoreGradient(score: number): string {
  if (score >= 70) return 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';
  if (score >= 50) return 'linear-gradient(135deg, #f5911e 0%, #fbb04a 100%)';
  return 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
}

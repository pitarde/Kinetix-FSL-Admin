export function pct(fraction, digits = 0) {
  if (fraction == null || Number.isNaN(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

export function num(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString()
}

export function minutes(mins) {
  if (mins == null || Number.isNaN(mins) || mins <= 0) return '—'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

export function relativeDays(days) {
  if (days == null) return 'never'
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function formatDate(date) {
  if (!date) return '—'
  const d = date.toDate ? date.toDate() : date
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

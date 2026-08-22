import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { rankIcon } from '../assets/icons'

export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

// ── Avatar + rank badge ─────────────────────────────────────────────────────

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export function Avatar({ name, url, size = 36 }) {
  const [failed, setFailed] = useState(false)
  const px = { width: size, height: size }
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        style={px}
        onError={() => setFailed(true)}
        className="rounded-full object-cover bg-slate-200 dark:bg-slate-700 shrink-0"
      />
    )
  }
  return (
    <div
      style={px}
      className="rounded-full shrink-0 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-semibold"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
    </div>
  )
}

const RANK_PILL_TONE = {
  'Novice Signer': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'Skilled Signer': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Expert Signer': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Master Signer': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

/** The app's own rank badge image + tier label. `pill` renders it as a
 *  colored pill (per rank tier) for use on the profile view. */
export function RankBadge({ rank, size = 22, showLabel = true, pill = false }) {
  if (pill) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
        RANK_PILL_TONE[rank] || RANK_PILL_TONE['Novice Signer'],
      )}>
        <img src={rankIcon(rank)} alt="" style={{ width: size, height: size }} className="shrink-0" />
        {showLabel && <span>{rank}</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <img src={rankIcon(rank)} alt="" style={{ width: size, height: size }} className="shrink-0" />
      {showLabel && <span className="text-slate-700 dark:text-slate-200">{rank}</span>}
    </span>
  )
}

// ── Reason picker (preset + custom) ─────────────────────────────────────────

/**
 * A default-reason dropdown plus a free-text override, so an admin can pick a
 * standard reason in one click instead of typing. `value` is the effective
 * reason string; `onChange` receives it.
 */
export function ReasonSelect({ presets = [], value, onChange, label = 'Reason (shown to the learner)' }) {
  const [mode, setMode] = useState('preset') // 'preset' | 'custom'
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <div className="mt-1 space-y-2">
        <select
          value={mode === 'custom' ? '__custom__' : (value || '')}
          onChange={(e) => {
            if (e.target.value === '__custom__') { setMode('custom'); onChange('') }
            else { setMode('preset'); onChange(e.target.value) }
          }}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        >
          <option value="">Select a reason…</option>
          {presets.map((p) => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">Custom reason…</option>
        </select>
        {mode === 'custom' && (
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a custom reason"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
      </div>
    </div>
  )
}

// ── Page scaffolding ────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className, children }) {
  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800',
      className,
    )}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h2>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

export function StatCard({ label, value, sub, tone = 'default' }) {
  const toneClass = {
    default: 'text-slate-900 dark:text-white',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-rose-600 dark:text-rose-400',
  }[tone]
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={cn('text-2xl font-semibold', toneClass)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
    </Card>
  )
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}

export function EmptyState({ title, hint }) {
  return (
    <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-10 text-center">
      <p className="text-slate-500 dark:text-slate-400 font-medium">{title}</p>
      {hint && <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400 dark:text-slate-500">
      <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-500 animate-spin" />
      {label}
    </div>
  )
}

export function Btn({ children, onClick, variant = 'default', size = 'md', disabled, type = 'button', className }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    warn: 'bg-amber-500 text-white hover:bg-amber-600',
    ghost: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
    outline: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
  }
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className,
      )}
    >
      {children}
    </button>
  )
}

export function ProgressBar({ fraction, tone = 'indigo' }) {
  const f = Math.max(0, Math.min(1, fraction || 0))
  const tones = {
    indigo: 'bg-indigo-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500',
  }
  return (
    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden min-w-[80px]">
      <div className={cn('h-full rounded-full', tones[tone])} style={{ width: `${f * 100}%` }} />
    </div>
  )
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-h-[85vh] overflow-y-auto',
        wide ? 'max-w-2xl' : 'max-w-md',
      )}>
        {title && (
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Toast ───────────────────────────────────────────────────────────────────

const ToastContext = createContext(() => {})
export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, tone = 'default') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn(
            'px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm',
            t.tone === 'error' ? 'bg-rose-600 text-white'
              : t.tone === 'success' ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-white',
          )}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

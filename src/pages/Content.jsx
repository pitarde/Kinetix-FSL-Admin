import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { CATEGORIES } from '../firestore/signCatalog'
import { subscribeContentOverrides, setModuleEnabled } from '../firestore/content'
import { computeAnalytics } from '../firestore/analytics'
import { useLearners } from '../hooks/useLearners'
import { Card, PageHeader, Badge, Btn, useToast } from '../components/ui'
import { moduleIcon } from '../assets/icons'
import { pct } from '../lib/format'

export default function Content() {
  const { user: admin } = useAuth()
  const toast = useToast()
  const { learners } = useLearners()
  const [overrides, setOverrides] = useState({})
  const [busy, setBusy] = useState(null)

  useEffect(() => subscribeContentOverrides(setOverrides, () => setOverrides({})), [])

  // Surface each module's live accuracy so the admin can spot which need a
  // better demo video — the "needs attention" signal for content work.
  const accuracyByCat = useMemo(() => {
    const a = computeAnalytics(learners).diagnostic.perCategory
    return Object.fromEntries(a.map((c) => [c.id, c.accuracy]))
  }, [learners])

  async function toggle(cat) {
    const currentlyDisabled = !!overrides[cat.id]?.disabled
    const nextEnabled = currentlyDisabled // if disabled now, we're turning it on
    setBusy(cat.id)
    try {
      await setModuleEnabled(cat.id, nextEnabled, admin, { title: cat.title })
      toast(nextEnabled ? `${cat.title} enabled` : `${cat.title} hidden`, 'success')
    } catch (e) {
      toast(e.message || 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Content Management"
        subtitle="The FSL lesson catalog, with enable/disable overrides and a live quality signal."
      />

      <Card className="p-4 mb-4 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
        <p className="text-sm text-indigo-800 dark:text-indigo-200">
          Show or hide learning modules in the app, and spot which ones need attention from their live accuracy.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const disabled = !!overrides[cat.id]?.disabled
          const acc = accuracyByCat[cat.id]
          const lowQuality = acc != null && acc < 0.5
          return (
            <Card key={cat.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {moduleIcon(cat.id) && (
                    <img
                      src={moduleIcon(cat.id)}
                      alt=""
                      className={`w-11 h-11 rounded-lg object-contain bg-slate-50 dark:bg-slate-800 p-1 shrink-0 ${disabled ? 'opacity-40 grayscale' : ''}`}
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{cat.title}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{cat.signs.length} signs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {disabled ? <Badge tone="red">Hidden</Badge> : <Badge tone="green">Live</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {cat.signs.slice(0, 12).map(([id, name]) => (
                  <span key={id} className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{name}</span>
                ))}
                {cat.signs.length > 12 && <span className="px-2 py-0.5 text-xs text-slate-400">+{cat.signs.length - 12}</span>}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Live accuracy: <span className={lowQuality ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'font-medium text-slate-700 dark:text-slate-200'}>{pct(acc)}</span>
                  {lowQuality && <span className="ml-2 text-xs text-rose-500">needs a better demo</span>}
                </span>
                <Btn size="sm" variant={disabled ? 'primary' : 'outline'} disabled={busy === cat.id} onClick={() => toggle(cat)}>
                  {disabled ? 'Enable' : 'Hide module'}
                </Btn>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

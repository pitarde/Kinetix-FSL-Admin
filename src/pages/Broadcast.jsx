import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { AUDIENCES, createBroadcast, subscribeBroadcasts, deleteBroadcast } from '../firestore/broadcasts'
import { Card, PageHeader, SectionTitle, Badge, Btn, EmptyState, useToast, Modal } from '../components/ui'
import { formatDate, num } from '../lib/format'

export default function Broadcast() {
  const { user: admin } = useAuth()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => subscribeBroadcasts(setHistory, () => setHistory([])), [])

  const canSend = title.trim() && body.trim()

  async function send() {
    setSending(true)
    try {
      const r = await createBroadcast(admin, { title: title.trim(), body: body.trim(), audience })
      toast(`Sent to ${num(r.delivered)} learner${r.delivered === 1 ? '' : 's'}`, 'success')
      setTitle(''); setBody(''); setConfirmSend(false)
    } catch (e) {
      toast(e.message || 'Failed to send', 'error')
    } finally {
      setSending(false)
    }
  }

  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label

  return (
    <div>
      <PageHeader title="Broadcast" subtitle="Send an announcement to learners' in-app notification inboxes." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle>Compose announcement</SectionTitle>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
                placeholder="e.g. New Emergency signs added!"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={500}
                placeholder="What do you want learners to know?"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Audience</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <Btn variant="primary" disabled={!canSend || sending} onClick={() => setConfirmSend(true)}>
              {sending ? 'Sending…' : 'Send announcement'}
            </Btn>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Preview</SectionTitle>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300">📣</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{title || 'Announcement title'}</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{body || 'Your message appears here.'}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">To: {audienceLabel}</p>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>Sent history</SectionTitle>
        {history.length === 0 ? <EmptyState title="No announcements sent yet" /> : (
          <div className="space-y-3">
            {history.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{b.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{b.body}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge tone="indigo">{AUDIENCES.find((a) => a.value === b.audience)?.label || b.audience}</Badge>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {num(b.recipientCount)} recipients · {formatDate(b.createdAt)} · by {b.createdBy}
                      </span>
                    </div>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => deleteBroadcast(b.id, admin)}>Delete record</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={confirmSend} onClose={() => setConfirmSend(false)} title="Send this announcement?"
        footer={<>
          <Btn variant="ghost" onClick={() => setConfirmSend(false)}>Cancel</Btn>
          <Btn variant="primary" disabled={sending} onClick={send}>{sending ? 'Sending…' : 'Send now'}</Btn>
        </>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This delivers "<span className="font-medium">{title}</span>" to <span className="font-medium">{audienceLabel}</span> and
          cannot be recalled from learners' inboxes once sent.
        </p>
      </Modal>
    </div>
  )
}

export default function Placeholder({ title, description }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">{title}</h1>
      {description && <p className="text-slate-500 dark:text-slate-400 mb-6">{description}</p>}
      <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-10 text-center text-slate-400 dark:text-slate-600">
        Coming soon
      </div>
    </div>
  )
}

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useTheme } from '../ThemeContext'

// Palette shared across every chart so the console reads as one system. Mirrors
// the mobile Profile analytics accents (Progress / Weak / Forecast / Coach).
export const PALETTE = {
  indigo: '#6C5CE7',
  green: '#00B894',
  red: '#FF6B6B',
  amber: '#FFA94D',
  yellow: '#FFD43B',
  violet: '#A55EEA',
  blue: '#4C8DFF',
}
export const SERIES_COLORS = [
  PALETTE.indigo, PALETTE.green, PALETTE.blue, PALETTE.amber,
  PALETTE.violet, PALETTE.red, PALETTE.yellow,
]

function useChartTheme() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    grid: dark ? '#1e293b' : '#e2e8f0',
    axis: dark ? '#94a3b8' : '#64748b',
    tooltipBg: dark ? '#0f172a' : '#ffffff',
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
    tooltipText: dark ? '#e2e8f0' : '#0f172a',
  }
}

function tooltipStyle(t) {
  return {
    contentStyle: {
      background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`,
      borderRadius: 10, fontSize: 12, color: t.tooltipText,
    },
    labelStyle: { color: t.tooltipText, fontWeight: 600 },
    itemStyle: { color: t.tooltipText },
  }
}

export function LineTrend({ data, xKey, series, height = 260, yFormatter }) {
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} stroke={t.axis} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis stroke={t.axis} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={yFormatter} />
        <Tooltip {...tooltipStyle(t)} formatter={yFormatter ? (v) => yFormatter(v) : undefined} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            strokeDasharray={s.dashed ? '6 5' : undefined}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function BarSeries({ data, xKey, barKey, name, color = PALETTE.indigo, height = 260, yFormatter, horizontal }) {
  const t = useChartTheme()
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke={t.axis} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={yFormatter} />
          <YAxis type="category" dataKey={xKey} stroke={t.axis} tick={{ fontSize: 12 }} width={130} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle(t)} formatter={yFormatter ? (v) => yFormatter(v) : undefined} cursor={{ fill: t.grid, opacity: 0.4 }} />
          <Bar dataKey={barKey} name={name} fill={color} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} stroke={t.axis} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis stroke={t.axis} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={yFormatter} />
        <Tooltip {...tooltipStyle(t)} formatter={yFormatter ? (v) => yFormatter(v) : undefined} cursor={{ fill: t.grid, opacity: 0.4 }} />
        <Bar dataKey={barKey} name={name} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DonutBreakdown({ data, height = 220 }) {
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color || SERIES_COLORS[i % SERIES_COLORS.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle(t)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

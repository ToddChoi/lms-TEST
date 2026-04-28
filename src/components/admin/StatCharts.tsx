'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

interface DailyData {
  date: string
  count: number
}

interface CategoryData {
  name: string
  count: number
}

export function DailyEnrollChart({ data }: { data: DailyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8F2FC" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #E8F2FC', fontSize: 12 }}
          formatter={(value: any) => [`${value}건`, '수강신청'] as [string, string]}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#2D7DD2"
          strokeWidth={2}
          dot={{ r: 3, fill: '#2D7DD2' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function CategoryBarChart({ data }: { data: CategoryData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8F2FC" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #E8F2FC', fontSize: 12 }}
          formatter={(value: any) => [`${value}개`, '강좌 수'] as [string, string]}
        />
        <Bar dataKey="count" fill="#2D7DD2" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface CompletionData {
  name: string
  value: number
}

const COMPLETION_COLOR_MAP: Record<string, string> = {
  active: '#2D7DD2',
  completed: '#10B981',
  expired: '#9CA3AF',
  cancelled: '#9CA3AF',
}

const COMPLETION_LABELS: Record<string, string> = {
  active: '수강중',
  completed: '수료',
  expired: '만료',
  cancelled: '취소',
}

export function CompletionPieChart({ data }: { data: CompletionData[] }) {
  const labeled = data.map((d) => ({
    ...d,
    label: COMPLETION_LABELS[d.name] ?? d.name,
  }))
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={labeled}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label
        >
          {labeled.map((entry, idx) => (
            <Cell key={idx} fill={COMPLETION_COLOR_MAP[entry.name] ?? '#9CA3AF'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #E8F2FC', fontSize: 12 }}
          formatter={(value: any, name: any) => [`${value}건`, String(name)] as [string, string]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

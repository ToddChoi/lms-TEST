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

interface CourseData {
  name: string
  count: number
}

interface CompletionData {
  name: string
  value: number
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

export function CoursePopularityChart({ data }: { data: CourseData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8F2FC" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #E8F2FC', fontSize: 12 }}
          formatter={(value: any) => [`${value}건`, '수강'] as [string, string]}
        />
        <Bar dataKey="count" fill="#2D7DD2" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const COMPLETION_COLORS: Record<string, string> = {
  active: '#2D7DD2',
  completed: '#10B981',
  expired: '#9CA3AF',
  cancelled: '#9CA3AF',
}

export function CompletionPieChart({ data }: { data: CompletionData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label
        >
          {data.map((entry, idx) => (
            <Cell
              key={idx}
              fill={COMPLETION_COLORS[entry.name] ?? '#9CA3AF'}
            />
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

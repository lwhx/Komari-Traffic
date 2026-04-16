import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'
import type { DailyTraffic } from '../types'
import { formatBytesShort, formatDate } from '../utils'

interface TrafficChartProps {
  data: DailyTraffic[]
}

interface TooltipPayloadItem {
  value: number
  dataKey: string
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const barItems = payload.filter(p => p.dataKey === 'upload' || p.dataKey === 'download')
  const totalItem = payload.find(p => p.dataKey === 'total')

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 16px',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-sans)',
      minWidth: 160,
    }}>
      <p style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        marginBottom: 8,
        fontFamily: 'var(--font-mono)',
      }}>
        {label}
      </p>
      {barItems.map((item: TooltipPayloadItem) => (
        <div key={item.dataKey} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          marginBottom: 4,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: item.color,
            flexShrink: 0,
          }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            {item.dataKey === 'upload' ? '上传' : '下载'}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            color: 'var(--text)',
            marginLeft: 'auto',
          }}>
            {formatBytesShort(item.value)}
          </span>
        </div>
      ))}
      <div style={{
        borderTop: '1px solid var(--border-light)',
        marginTop: 8,
        paddingTop: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--total-color)',
          flexShrink: 0,
        }} />
        <span style={{ color: 'var(--text-secondary)' }}>合计</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--text)',
          marginLeft: 'auto',
        }}>
          {formatBytesShort(totalItem?.value ?? barItems.reduce((s: number, i: TooltipPayloadItem) => s + i.value, 0))}
        </span>
      </div>
    </div>
  )
}

export function TrafficChart({ data }: TrafficChartProps) {
  if (data.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px 0',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}>
        暂无流量数据
      </div>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    dateLabel: formatDate(d.date),
  }))

  const maxVal = Math.max(...data.map(d => Math.max(d.upload, d.download, d.total)), 0)
  const avgTotal = data.reduce((s, d) => s + d.total, 0) / data.length

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={chartData}
        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        barGap={2}
        barCategoryGap="20%"
      >
        <defs>
          <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--total-color)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--total-color)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-light)"
          vertical={false}
        />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatBytesShort(v)}
          width={60}
          domain={[0, maxVal * 1.15]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
        <ReferenceLine y={0} stroke="var(--border)" />
        {avgTotal > 0 && (
          <ReferenceLine
            y={avgTotal}
            stroke="var(--total-color)"
            strokeDasharray="6 4"
            strokeOpacity={0.5}
            label={{
              value: `均值 ${formatBytesShort(avgTotal)}`,
              position: 'insideTopRight',
              fill: 'var(--total-color)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="total"
          fill="url(#totalGradient)"
          stroke="none"
          dot={false}
          activeDot={false}
        />
        <Bar
          dataKey="upload"
          name="上传"
          fill="var(--upload-color)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="download"
          name="下载"
          fill="var(--download-color)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

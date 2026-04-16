import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { getNodes, getRecords, getNodesLatestStatus } from '../rpc'
import { computeDailyTraffic, getLastNDays, formatBytesShort, formatDate, formatBytes } from '../utils'
import type { NodeTraffic, Client, DailyTraffic } from '../types'
import './AnalysisPage.css'

/**
 * 自定义 Tooltip 属性
 */
interface AnalysisTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
  threshold?: number
}

/**
 * 分析页面 Tooltip 组件
 */
function AnalysisTooltip({ active, payload, label, threshold }: AnalysisTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const barItems = payload.filter(p => p.dataKey === 'upload' || p.dataKey === 'download')
  const total = barItems.reduce((s, i) => s + i.value, 0)
  const isOverThreshold = threshold && threshold > 0 && total > threshold

  return (
    <div className="analysis-tooltip">
      <p className="at-time">{label}</p>
      {barItems.map(item => (
        <div key={item.dataKey} className="at-row">
          <span className="at-dot" style={{ background: item.color }} />
          <span className="at-label">{item.dataKey === 'upload' ? '上传' : '下载'}</span>
          <span className="at-value">{formatBytesShort(item.value)}</span>
        </div>
      ))}
      <div className="at-row at-total">
        <span className="at-label">合计</span>
        <span className="at-value">{formatBytesShort(total)}</span>
      </div>
      {threshold && threshold > 0 && (
        <div className={`at-threshold ${isOverThreshold ? 'over' : ''}`}>
          {isOverThreshold ? '⚠ 超出阈值' : `阈值: ${formatBytesShort(threshold)}`}
        </div>
      )}
    </div>
  )
}

/**
 * 计算环比增长率
 * @param current - 当前值
 * @param previous - 上一期值
 * @returns 增长百分比，正数表示增长，负数表示下降
 */
function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * 迷你折线图 SVG 组件
 * @property data - 数据点数组
 * @property width - SVG 宽度
 * @property height - SVG 高度
 * @property color - 线条颜色
 */
function Sparkline({ data, width = 80, height = 28, color = 'var(--accent)' }: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (data.length < 2) return <span className="sparkline-empty">-</span>

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="sparkline-svg">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 流量分析页面
 * 包含：阈值标记、趋势环比、迷你折线图
 */
export default function AnalysisPage() {
  const [nodes, setNodes] = useState<NodeTraffic[]>([])
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(7)
  const [threshold, setThreshold] = useState(10)
  const [thresholdUnit, setThresholdUnit] = useState<'GB' | 'MB' | 'TB'>('GB')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [nodesMap, statusMap] = await Promise.all([
        getNodes(),
        getNodesLatestStatus().catch(() => ({})),
      ])
      const nodeEntries = Object.entries(nodesMap as Record<string, Client>)
      const { start, end } = getLastNDays(days)

      const results: NodeTraffic[] = await Promise.all(
        nodeEntries.map(async ([uuid, info]) => {
          const status = (statusMap as Record<string, any>)[uuid]
          try {
            const records = await getRecords(uuid, start, end)
            const daily = computeDailyTraffic(records)
            return {
              uuid,
              name: info.name || uuid.slice(0, 8),
              ipv4: info.ipv4 || '',
              ipv6: info.ipv6 || '',
              region: info.region || '',
              online: status?.online ?? false,
              currentIn: status?.net_in ?? 0,
              currentOut: status?.net_out ?? 0,
              dailyTraffic: daily,
              totalUpload: daily.reduce((s, d) => s + d.upload, 0),
              totalDownload: daily.reduce((s, d) => s + d.download, 0),
            }
          } catch {
            return {
              uuid, name: info.name || uuid.slice(0, 8),
              ipv4: info.ipv4 || '', ipv6: info.ipv6 || '', region: info.region || '',
              online: status?.online ?? false, currentIn: 0, currentOut: 0,
              dailyTraffic: [], totalUpload: 0, totalDownload: 0,
            }
          }
        }),
      )
      setNodes(results)
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  /**
   * 将阈值转换为字节数
   */
  const thresholdBytes = useMemo(() => {
    const multipliers = { MB: 1024 * 1024, GB: 1024 ** 3, TB: 1024 ** 4 }
    return threshold * (multipliers[thresholdUnit] || 1)
  }, [threshold, thresholdUnit])

  /**
   * 当前选中节点或全部节点的图表数据
   */
  const chartData = useMemo(() => {
    if (selectedNode) {
      return nodes.find(n => n.uuid === selectedNode)?.dailyTraffic ?? []
    }
    const map = new Map<string, DailyTraffic>()
    for (const node of nodes) {
      for (const d of node.dailyTraffic) {
        if (!map.has(d.date)) map.set(d.date, { date: d.date, upload: 0, download: 0, total: 0 })
        const entry = map.get(d.date)!
        entry.upload += d.upload
        entry.download += d.download
        entry.total += d.total
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [nodes, selectedNode])

  /**
   * 超出阈值的天数
   */
  const overThresholdDays = useMemo(
    () => chartData.filter(d => d.total > thresholdBytes).length,
    [chartData, thresholdBytes],
  )

  /**
   * 环比增长率
   */
  const growth = useMemo(() => {
    if (chartData.length < 2) return null
    const last = chartData[chartData.length - 1].total
    const prev = chartData[chartData.length - 2].total
    return calcGrowth(last, prev)
  }, [chartData])

  const avgTotal = chartData.length > 0
    ? chartData.reduce((s, d) => s + d.total, 0) / chartData.length
    : 0

  const maxVal = Math.max(...chartData.map(d => Math.max(d.upload, d.download, d.total)), 0)

  const displayData = chartData.map(d => ({ ...d, dateLabel: formatDate(d.date) }))

  return (
    <div className="analysis-page">
      <div className="analysis-controls">
        <div className="control-group">
          <label className="control-label">查看节点</label>
          <select
            className="control-select"
            value={selectedNode ?? '__all__'}
            onChange={e => setSelectedNode(e.target.value === '__all__' ? null : e.target.value)}
          >
            <option value="__all__">全部节点</option>
            {nodes.map(n => (
              <option key={n.uuid} value={n.uuid}>{n.name}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label className="control-label">时间范围</label>
          <div className="interval-btns">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                className={`interval-btn ${days === d ? 'active' : ''}`}
                onClick={() => setDays(d)}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label className="control-label">每日流量阈值</label>
          <div className="threshold-input">
            <input
              type="number"
              className="threshold-field"
              value={threshold}
              min={0}
              step={1}
              onChange={e => setThreshold(Number(e.target.value))}
            />
            <select
              className="threshold-unit"
              value={thresholdUnit}
              onChange={e => setThresholdUnit(e.target.value as 'GB' | 'MB' | 'TB')}
            >
              <option value="MB">MB</option>
              <option value="GB">GB</option>
              <option value="TB">TB</option>
            </select>
          </div>
        </div>
      </div>

      <div className="analysis-summary">
        <div className="summary-card">
          <span className="summary-label">环比变化</span>
          <span className={`summary-value ${growth && growth > 0 ? 'up' : growth && growth < 0 ? 'down' : ''}`}>
            {growth !== null ? `${growth > 0 ? '↑' : '↓'} ${Math.abs(growth).toFixed(1)}%` : '-'}
          </span>
          <span className="summary-sub">较前一日</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">超出阈值</span>
          <span className={`summary-value ${overThresholdDays > 0 ? 'warning' : ''}`}>
            {overThresholdDays} 天
          </span>
          <span className="summary-sub">阈值 {threshold} {thresholdUnit}/天</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">日均流量</span>
          <span className="summary-value">{formatBytes(avgTotal)}</span>
          <span className="summary-sub">近 {days} 天</span>
        </div>
      </div>

      <div className="analysis-chart-card">
        {loading ? (
          <div className="analysis-loading">加载中...</div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={displayData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }} barGap={2} barCategoryGap="20%">
              <defs>
                <linearGradient id="analysisTotalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--total-color)" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="var(--total-color)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatBytesShort(v)} width={60} domain={[0, maxVal * 1.15]} />
              <Tooltip content={<AnalysisTooltip threshold={thresholdBytes} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              {thresholdBytes > 0 && (
                <ReferenceLine y={thresholdBytes} stroke="var(--danger)" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `阈值 ${threshold}${thresholdUnit}`, position: 'insideTopRight', fill: 'var(--danger)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
              )}
              {avgTotal > 0 && (
                <ReferenceLine y={avgTotal} stroke="var(--total-color)" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: `均值`, position: 'insideTopLeft', fill: 'var(--total-color)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
              )}
              <Area type="monotone" dataKey="total" fill="url(#analysisTotalGrad)" stroke="none" dot={false} activeDot={false} />
              <Bar dataKey="upload" name="上传" fill="var(--upload-color)" radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="download" name="下载" fill="var(--download-color)" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="analysis-empty">暂无数据</div>
        )}
      </div>

      <section className="sparkline-section">
        <h3 className="section-title">节点流量趋势</h3>
        <div className="sparkline-grid">
          {nodes.map(node => {
            const total = node.totalUpload + node.totalDownload
            const sparkData = node.dailyTraffic.map(d => d.total)
            const isOver = node.dailyTraffic.some(d => d.total > thresholdBytes)
            return (
              <div
                key={node.uuid}
                className={`sparkline-card ${isOver ? 'over-threshold' : ''} ${selectedNode === node.uuid ? 'selected' : ''}`}
                onClick={() => setSelectedNode(selectedNode === node.uuid ? null : node.uuid)}
              >
                <div className="spark-header">
                  <span className={`spark-status ${node.online ? 'online' : 'offline'}`} />
                  <span className="spark-name">{node.name}</span>
                  {isOver && <span className="spark-warning">⚠</span>}
                </div>
                <Sparkline data={sparkData} width={100} height={30} color={isOver ? 'var(--danger)' : 'var(--accent)'} />
                <div className="spark-footer">
                  <span className="spark-total">{formatBytes(total)}</span>
                  <span className="spark-days">{node.dailyTraffic.length}天</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

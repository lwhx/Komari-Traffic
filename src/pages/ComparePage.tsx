import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { getNodes, getRecords } from '../rpc'
import { computeDailyTraffic, getLastNDays, formatBytesShort, formatDate, formatBytes } from '../utils'
import type { NodeTraffic, Client, DailyTraffic } from '../types'
import './ComparePage.css'

/**
 * 对比图表配色方案
 */
const COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b',
  '#ef4444', '#22c55e', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1', '#84cc16', '#e11d48',
]

/**
 * 自定义 Tooltip 属性
 */
interface CompareTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string; name?: string }>
  label?: string
}

/**
 * 对比页面 Tooltip 组件
 */
function CompareTooltip({ active, payload, label }: CompareTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="compare-tooltip">
      <p className="ct-time">{label}</p>
      {payload.map(item => (
        <div key={item.dataKey} className="ct-row">
          <span className="ct-dot" style={{ background: item.color }} />
          <span className="ct-name">{item.name || item.dataKey}</span>
          <span className="ct-value">{formatBytesShort(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * 节点对比页面
 * 支持多选节点，在同一图表中对比各节点的流量趋势
 */
export default function ComparePage() {
  const [nodes, setNodes] = useState<NodeTraffic[]>([])
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(7)
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'total' | 'upload' | 'download'>('total')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const nodesMap = await getNodes()
      const nodeEntries = Object.entries(nodesMap as Record<string, Client>)
      const { start, end } = getLastNDays(days)

      const results: NodeTraffic[] = await Promise.all(
        nodeEntries.map(async ([uuid, info]) => {
          try {
            const records = await getRecords(uuid, start, end)
            const daily = computeDailyTraffic(records)
            return {
              uuid, name: info.name || uuid.slice(0, 8),
              ipv4: info.ipv4 || '', ipv6: info.ipv6 || '', region: info.region || '',
              online: false, currentIn: 0, currentOut: 0,
              dailyTraffic: daily,
              totalUpload: daily.reduce((s, d) => s + d.upload, 0),
              totalDownload: daily.reduce((s, d) => s + d.download, 0),
            }
          } catch {
            return {
              uuid, name: info.name || uuid.slice(0, 8),
              ipv4: info.ipv4 || '', ipv6: info.ipv6 || '', region: info.region || '',
              online: false, currentIn: 0, currentOut: 0,
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
   * 切换节点选中状态
   */
  const toggleNode = (uuid: string) => {
    setSelectedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  /**
   * 全选/取消全选
   */
  const toggleAll = () => {
    if (selectedUuids.size === nodes.length) {
      setSelectedUuids(new Set())
    } else {
      setSelectedUuids(new Set(nodes.map(n => n.uuid)))
    }
  }

  /**
   * 对比图表数据：合并选中节点的每日数据
   */
  const chartData = useMemo(() => {
    const selectedNodes = nodes.filter(n => selectedUuids.has(n.uuid))
    if (selectedNodes.length === 0) return []

    const dateMap = new Map<string, Record<string, number | string>>()

    for (const node of selectedNodes) {
      for (const d of node.dailyTraffic) {
        if (!dateMap.has(d.date)) dateMap.set(d.date, { dateLabel: formatDate(d.date) })
        const entry = dateMap.get(d.date)!
        const value = mode === 'upload' ? d.upload : mode === 'download' ? d.download : d.total
        entry[node.uuid] = value
      }
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
  }, [nodes, selectedUuids, mode])

  const selectedNodes = nodes.filter(n => selectedUuids.has(n.uuid))

  return (
    <div className="compare-page">
      <div className="compare-controls">
        <div className="control-group">
          <label className="control-label">时间范围</label>
          <div className="interval-btns">
            {[7, 14, 30].map(d => (
              <button key={d} className={`interval-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
                {d}天
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label className="control-label">对比维度</label>
          <div className="interval-btns">
            {([['total', '合计'], ['upload', '上传'], ['download', '下载']] as const).map(([key, label]) => (
              <button key={key} className={`interval-btn ${mode === key ? 'active' : ''}`} onClick={() => setMode(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button className="toggle-all-btn" onClick={toggleAll}>
          {selectedUuids.size === nodes.length ? '取消全选' : '全选节点'}
        </button>
      </div>

      <div className="compare-body">
        <div className="compare-sidebar">
          <h3 className="sidebar-title">选择节点 ({selectedUuids.size}/{nodes.length})</h3>
          <div className="node-check-list">
            {nodes.map(node => {
              const total = node.totalUpload + node.totalDownload
              const checked = selectedUuids.has(node.uuid)
              const colorIdx = selectedNodes.indexOf(node)
              return (
                <label
                  key={node.uuid}
                  className={`node-check-item ${checked ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleNode(node.uuid)}
                  />
                  {checked && (
                    <span className="check-color" style={{ background: COLORS[colorIdx % COLORS.length] }} />
                  )}
                  <span className="check-name">{node.name}</span>
                  <span className="check-total">{formatBytes(total)}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="compare-chart-area">
          {loading ? (
            <div className="compare-empty">加载中...</div>
          ) : selectedUuids.size === 0 ? (
            <div className="compare-empty">请从左侧选择节点进行对比</div>
          ) : chartData.length > 0 ? (
            <>
              <div className="compare-chart-card">
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatBytesShort(v)} width={60} />
                    <Tooltip content={<CompareTooltip />} />
                    <Legend />
                    {selectedNodes.map((node, idx) => (
                      <Line
                        key={node.uuid}
                        type="monotone"
                        dataKey={node.uuid}
                        name={node.name}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3, fill: COLORS[idx % COLORS.length] }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="compare-table-card">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th>节点</th>
                      <th>总上传</th>
                      <th>总下载</th>
                      <th>总流量</th>
                      <th>日均</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedNodes.map((node, idx) => {
                      const total = node.totalUpload + node.totalDownload
                      const avg = node.dailyTraffic.length > 0 ? total / node.dailyTraffic.length : 0
                      return (
                        <tr key={node.uuid}>
                          <td>
                            <span className="table-color" style={{ background: COLORS[idx % COLORS.length] }} />
                            {node.name}
                          </td>
                          <td className="mono">{formatBytes(node.totalUpload)}</td>
                          <td className="mono">{formatBytes(node.totalDownload)}</td>
                          <td className="mono fw-600">{formatBytes(total)}</td>
                          <td className="mono">{formatBytes(avg)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="compare-empty">选中节点暂无数据</div>
          )}
        </div>
      </div>
    </div>
  )
}

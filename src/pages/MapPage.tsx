import { useState, useEffect, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { getNodes, getRecords, getNodesLatestStatus } from '../rpc'
import { computeDailyTraffic, getLastNDays, formatBytes, formatBytesShort } from '../utils'
import type { NodeTraffic, Client } from '../types'
import './MapPage.css'

/**
 * 饼图配色方案
 */
const PIE_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b',
  '#ef4444', '#22c55e', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1', '#84cc16', '#e11d48',
]

/**
 * 自定义 Tooltip 属性
 */
interface PieTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { percent: number } }>
}

/**
 * 饼图 Tooltip 组件
 */
function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
  return (
    <div className="pie-tooltip">
      <span className="pie-tooltip-name">{item.name}</span>
      <span className="pie-tooltip-value">{formatBytes(item.value)}</span>
      <span className="pie-tooltip-percent">{(item.payload.percent * 100).toFixed(1)}%</span>
    </div>
  )
}

/**
 * 区域分布页面
 * 用卡片和饼图展示各区域节点的流量分布
 */
export default function MapPage() {
  const [nodes, setNodes] = useState<NodeTraffic[]>([])
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(7)
  const [viewMode, setViewMode] = useState<'region' | 'node'>('region')

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
              uuid, name: info.name || uuid.slice(0, 8),
              ipv4: info.ipv4 || '', ipv6: info.ipv6 || '',
              region: info.region || '未知', online: status?.online ?? false,
              currentIn: status?.net_in ?? 0, currentOut: status?.net_out ?? 0,
              dailyTraffic: daily,
              totalUpload: daily.reduce((s, d) => s + d.upload, 0),
              totalDownload: daily.reduce((s, d) => s + d.download, 0),
            }
          } catch {
            return {
              uuid, name: info.name || uuid.slice(0, 8),
              ipv4: info.ipv4 || '', ipv6: info.ipv6 || '',
              region: info.region || '未知', online: false, currentIn: 0, currentOut: 0,
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
   * 按区域分组统计
   */
  const regionData = useMemo(() => {
    const map = new Map<string, { name: string; total: number; upload: number; download: number; count: number; onlineCount: number; nodes: NodeTraffic[] }>()
    for (const node of nodes) {
      const region = node.region || '未知'
      if (!map.has(region)) {
        map.set(region, { name: region, total: 0, upload: 0, download: 0, count: 0, onlineCount: 0, nodes: [] })
      }
      const entry = map.get(region)!
      const total = node.totalUpload + node.totalDownload
      entry.total += total
      entry.upload += node.totalUpload
      entry.download += node.totalDownload
      entry.count += 1
      entry.onlineCount += node.online ? 1 : 0
      entry.nodes.push(node)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [nodes])

  /**
   * 饼图数据（按区域或按节点）
   */
  const pieData = useMemo(() => {
    if (viewMode === 'region') {
      return regionData.map(r => ({ name: r.name, value: r.total }))
    }
    return nodes
      .map(n => ({ name: n.name, value: n.totalUpload + n.totalDownload }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  }, [regionData, nodes, viewMode])

  const globalTotal = nodes.reduce((s, n) => s + n.totalUpload + n.totalDownload, 0)

  return (
    <div className="map-page">
      <div className="map-controls">
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
          <label className="control-label">饼图维度</label>
          <div className="interval-btns">
            <button className={`interval-btn ${viewMode === 'region' ? 'active' : ''}`} onClick={() => setViewMode('region')}>按区域</button>
            <button className={`interval-btn ${viewMode === 'node' ? 'active' : ''}`} onClick={() => setViewMode('node')}>按节点</button>
          </div>
        </div>
      </div>

      <div className="map-body">
        <div className="map-chart-area">
          <div className="pie-card">
            <h3 className="pie-title">流量占比分布</h3>
            {loading ? (
              <div className="map-empty">加载中...</div>
            ) : pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={140}
                    dataKey="value"
                    paddingAngle={2}
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="map-empty">暂无数据</div>
            )}
            <div className="pie-center-label">
              <span className="pie-center-value">{formatBytesShort(globalTotal)}</span>
              <span className="pie-center-sub">总流量</span>
            </div>
          </div>
        </div>

        <div className="map-cards-area">
          <h3 className="cards-title">区域概览 ({regionData.length} 个区域)</h3>
          <div className="region-grid">
            {regionData.map((region, idx) => (
              <div key={region.name} className="region-card">
                <div className="region-header">
                  <span className="region-color" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="region-name">{region.name}</span>
                  <span className="region-percent">
                    {globalTotal > 0 ? ((region.total / globalTotal) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="region-bar">
                  <div
                    className="region-bar-fill"
                    style={{
                      width: `${globalTotal > 0 ? (region.total / globalTotal) * 100 : 0}%`,
                      background: PIE_COLORS[idx % PIE_COLORS.length],
                    }}
                  />
                </div>
                <div className="region-stats">
                  <span className="rs-item">↑ {formatBytesShort(region.upload)}</span>
                  <span className="rs-item">↓ {formatBytesShort(region.download)}</span>
                  <span className="rs-item rs-total">= {formatBytesShort(region.total)}</span>
                </div>
                <div className="region-meta">
                  <span className="rm-nodes">{region.count} 节点</span>
                  <span className="rm-online">{region.onlineCount} 在线</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

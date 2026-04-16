import { useState, useEffect, useCallback, useRef } from 'react'
import { getNodes, getRecords, getNodesLatestStatus } from '../rpc'
import { computeDailyTraffic, getLastNDays, sumAllNodesTraffic, getTodayTraffic, formatBytes, formatSpeed } from '../utils'
import type { NodeTraffic, DailyTraffic, Client } from '../types'
import { TrafficChart } from '../components/TrafficChart'
import { NodeTable } from '../components/NodeTable'
import './DashboardPage.css'

/**
 * 仪表盘页面（原首页）
 * 展示统计卡片、流量图表和节点列表
 */
export default function DashboardPage() {
  const [nodes, setNodes] = useState<NodeTraffic[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [days, setDays] = useState(7)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nodesMap, statusMap] = await Promise.all([
        getNodes(),
        getNodesLatestStatus().catch(() => ({} as Record<string, any>)),
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
              uuid,
              name: info.name || uuid.slice(0, 8),
              ipv4: info.ipv4 || '',
              ipv6: info.ipv6 || '',
              region: info.region || '',
              online: status?.online ?? false,
              currentIn: status?.net_in ?? 0,
              currentOut: status?.net_out ?? 0,
              dailyTraffic: [],
              totalUpload: 0,
              totalDownload: 0,
            }
          }
        }),
      )

      setNodes(results)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchData, 60000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoRefresh, fetchData])

  const onlineCount = nodes.filter(n => n.online).length
  const totalUpload = nodes.reduce((s, n) => s + n.totalUpload, 0)
  const totalDownload = nodes.reduce((s, n) => s + n.totalDownload, 0)
  const todayTraffic = getTodayTraffic(nodes)

  const currentChartData: DailyTraffic[] = selectedNode
    ? (nodes.find(n => n.uuid === selectedNode)?.dailyTraffic ?? [])
    : sumAllNodesTraffic(nodes)

  const currentNodeName = selectedNode
    ? nodes.find(n => n.uuid === selectedNode)?.name ?? selectedNode.slice(0, 8)
    : '全部节点'

  return (
    <div className="dashboard-page">
      <div className="dashboard-toolbar">
        <div className="days-selector">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              className={`days-btn ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d}天
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            className={`icon-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? '停止自动刷新' : '开启自动刷新(60s)'}
          >
            {autoRefresh ? '⏸' : '▶'}
          </button>
          <button className="icon-btn" onClick={() => fetchData()} title="刷新数据">
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠ {error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon nodes-icon">◉</div>
          <div className="stat-body">
            <div className="stat-value">{nodes.length}</div>
            <div className="stat-label">节点总数</div>
            <div className="stat-sub">{onlineCount} 在线</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon upload-icon">↑</div>
          <div className="stat-body">
            <div className="stat-value">{formatBytes(totalUpload)}</div>
            <div className="stat-label">累计上传 ({days}天)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon download-icon">↓</div>
          <div className="stat-body">
            <div className="stat-value">{formatBytes(totalDownload)}</div>
            <div className="stat-label">累计下载 ({days}天)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon today-icon">⏎</div>
          <div className="stat-body">
            <div className="stat-value">{formatBytes(todayTraffic.upload + todayTraffic.download)}</div>
            <div className="stat-label">今日流量</div>
            <div className="stat-sub">↑{formatBytes(todayTraffic.upload)} ↓{formatBytes(todayTraffic.download)}</div>
          </div>
        </div>
      </section>

      {loading && nodes.length === 0 && (
        <div className="loading-overlay">
          <div className="spinner" />
          <span>正在获取流量数据...</span>
        </div>
      )}

      {nodes.length > 0 && (
        <>
          <section className="chart-section">
            <div className="section-header">
              <h2>{currentNodeName}</h2>
              {selectedNode && (
                <button className="back-btn" onClick={() => setSelectedNode(null)}>
                  ← 查看全部
                </button>
              )}
            </div>
            <div className="chart-card">
              <TrafficChart data={currentChartData} />
            </div>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--upload-color)' }} />
                上传
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--download-color)' }} />
                下载
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: 'var(--total-color)' }} />
                合计趋势
              </span>
            </div>
          </section>

          <section className="table-section">
            <h2>节点列表</h2>
            <NodeTable
              nodes={nodes}
              selectedUuid={selectedNode}
              onSelect={setSelectedNode}
            />
          </section>
        </>
      )}

      {lastUpdate && (
        <footer className="footer">
          上次更新: {lastUpdate.toLocaleTimeString('zh-CN')}
          {autoRefresh && <span className="refresh-badge">自动刷新中</span>}
        </footer>
      )}
    </div>
  )
}

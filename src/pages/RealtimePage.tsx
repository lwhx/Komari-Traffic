import { useState, useEffect, useCallback, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getNodes, getNodesLatestStatus } from '../rpc'
import { formatSpeed } from '../utils'
import type { Client, NodeStatus } from '../types'
import './RealtimePage.css'

/**
 * 实时速度数据点
 * @property time - 时间戳字符串
 * @property upload - 上传速度 (bytes/s)
 * @property download - 下载速度 (bytes/s)
 */
interface SpeedPoint {
  time: string
  upload: number
  download: number
}

/**
 * 刷新间隔选项
 */
const REFRESH_OPTIONS = [
  { value: 3, label: '3秒' },
  { value: 5, label: '5秒' },
  { value: 10, label: '10秒' },
  { value: 30, label: '30秒' },
  { value: 60, label: '60秒' },
]

/**
 * 最大保留的数据点数量
 */
const MAX_POINTS = 120

/**
 * 自定义 Tooltip 属性
 */
interface SpeedTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}

/**
 * 速度图表自定义提示框组件
 */
function SpeedTooltip({ active, payload, label }: SpeedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="speed-tooltip">
      <p className="speed-tooltip-time">{label}</p>
      {payload.map(item => (
        <div key={item.dataKey} className="speed-tooltip-row">
          <span
            className="speed-tooltip-dot"
            style={{ background: item.color }}
          />
          <span className="speed-tooltip-label">
            {item.dataKey === 'upload' ? '上传' : '下载'}
          </span>
          <span className="speed-tooltip-value">{formatSpeed(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * 实时监控页面
 * 展示所有节点的实时上下行速率折线图，支持自定义刷新间隔
 */
export default function RealtimePage() {
  const [nodesInfo, setNodesInfo] = useState<Record<string, Client>>({})
  const [selectedNode, setSelectedNode] = useState<string>('__all__')
  const [speedHistory, setSpeedHistory] = useState<SpeedPoint[]>([])
  const [interval, setInterval] = useState(5)
  const [isRunning, setIsRunning] = useState(true)
  const timerRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null)

  useEffect(() => {
    getNodes().then(setNodesInfo).catch(() => {})
  }, [])

  /**
   * 采集一次速度数据
   */
  const sample = useCallback(async () => {
    try {
      const statusMap: Record<string, NodeStatus> = await getNodesLatestStatus()
      const now = new Date()
      const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

      if (selectedNode === '__all__') {
        let totalIn = 0
        let totalOut = 0
        for (const s of Object.values(statusMap)) {
          totalIn += s.net_in
          totalOut += s.net_out
        }
        setSpeedHistory(prev => [...prev.slice(-(MAX_POINTS - 1)), { time: timeLabel, upload: totalOut, download: totalIn }])
      } else {
        const s = statusMap[selectedNode]
        setSpeedHistory(prev => [...prev.slice(-(MAX_POINTS - 1)), {
          time: timeLabel,
          upload: s?.net_out ?? 0,
          download: s?.net_in ?? 0,
        }])
      }
    } catch {
      /* 忽略采集失败 */
    }
  }, [selectedNode])

  useEffect(() => {
    if (isRunning) {
      sample()
      timerRef.current = globalThis.setInterval(sample, interval * 1000)
      return () => {
        if (timerRef.current) globalThis.clearInterval(timerRef.current)
      }
    } else {
      if (timerRef.current) globalThis.clearInterval(timerRef.current)
    }
  }, [isRunning, interval, sample])

  /**
   * 获取最新速度数据用于显示当前值
   */
  const latestPoint = speedHistory[speedHistory.length - 1]

  return (
    <div className="realtime-page">
      <div className="realtime-controls">
        <div className="control-group">
          <label className="control-label">选择节点</label>
          <select
            className="control-select"
            value={selectedNode}
            onChange={e => { setSelectedNode(e.target.value); setSpeedHistory([]) }}
          >
            <option value="__all__">全部节点</option>
            {Object.entries(nodesInfo).map(([uuid, info]) => (
              <option key={uuid} value={uuid}>{info.name || uuid.slice(0, 8)}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label className="control-label">刷新间隔</label>
          <div className="interval-btns">
            {REFRESH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`interval-btn ${interval === opt.value ? 'active' : ''}`}
                onClick={() => setInterval(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button
          className={`toggle-btn ${isRunning ? 'running' : 'paused'}`}
          onClick={() => setIsRunning(r => !r)}
        >
          {isRunning ? '⏸ 暂停' : '▶ 开始'}
        </button>
        <button
          className="clear-btn"
          onClick={() => setSpeedHistory([])}
        >
          ✕ 清除数据
        </button>
      </div>

      <div className="realtime-stats">
        <div className="rt-stat-card">
          <span className="rt-stat-label">当前上传</span>
          <span className="rt-stat-value upload">{latestPoint ? formatSpeed(latestPoint.upload) : '- B/s'}</span>
        </div>
        <div className="rt-stat-card">
          <span className="rt-stat-label">当前下载</span>
          <span className="rt-stat-value download">{latestPoint ? formatSpeed(latestPoint.download) : '- B/s'}</span>
        </div>
        <div className="rt-stat-card">
          <span className="rt-stat-label">采集点数</span>
          <span className="rt-stat-value">{speedHistory.length}</span>
        </div>
      </div>

      <div className="realtime-chart-card">
        {speedHistory.length > 1 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={speedHistory} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatSpeed(v)}
                width={80}
              />
              <Tooltip content={<SpeedTooltip />} />
              <Line
                type="monotone"
                dataKey="upload"
                stroke="var(--upload-color)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="download"
                stroke="var(--download-color)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="realtime-empty">
            {isRunning ? '正在采集数据，请稍候...' : '点击"开始"按钮开始采集实时速度数据'}
          </div>
        )}
      </div>

      <div className="realtime-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--upload-color)' }} />
          上传速度
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--download-color)' }} />
          下载速度
        </span>
      </div>
    </div>
  )
}

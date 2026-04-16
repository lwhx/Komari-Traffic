import { useState, useMemo } from 'react'
import type { NodeTraffic } from '../types'
import { formatBytes, formatBytesShort, formatDateFull, formatSpeed } from '../utils'
import './NodeTable.css'

type SortField = 'name' | 'upload' | 'download' | 'total' | 'online'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'online' | 'offline'

interface NodeTableProps {
  nodes: NodeTraffic[]
  selectedUuid: string | null
  onSelect: (uuid: string | null) => void
}

export function NodeTable({ nodes, selectedUuid, onSelect }: NodeTableProps) {
  const [sortField, setSortField] = useState<SortField>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const filteredNodes = useMemo(() => {
    if (statusFilter === 'all') return nodes
    return nodes.filter(n => statusFilter === 'online' ? n.online : !n.online)
  }, [nodes, statusFilter])

  const onlineCount = useMemo(() => nodes.filter(n => n.online).length, [nodes])
  const offlineCount = nodes.length - onlineCount

  const sortedNodes = useMemo(() => {
    const copy = [...filteredNodes]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'upload':
          cmp = a.totalUpload - b.totalUpload
          break
        case 'download':
          cmp = a.totalDownload - b.totalDownload
          break
        case 'total':
          cmp = (a.totalUpload + a.totalDownload) - (b.totalUpload + b.totalDownload)
          break
        case 'online':
          cmp = (a.online === b.online) ? 0 : a.online ? -1 : 1
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filteredNodes, sortField, sortDir])

  const maxTotal = useMemo(() => {
    return Math.max(...filteredNodes.map(n => n.totalUpload + n.totalDownload), 1)
  }, [filteredNodes])

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'total', label: '合计' },
    { field: 'upload', label: '上传' },
    { field: 'download', label: '下载' },
    { field: 'name', label: '名称' },
    { field: 'online', label: '状态' },
  ]

  if (nodes.length === 0) {
    return (
      <div className="table-wrap">
        <div className="table-empty">未发现任何节点</div>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <div className="filter-bar">
        <div className="filter-group">
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            全部 <span className="filter-count">{nodes.length}</span>
          </button>
          <button
            className={`filter-btn ${statusFilter === 'online' ? 'active' : ''}`}
            onClick={() => setStatusFilter('online')}
          >
            在线 <span className="filter-count">{onlineCount}</span>
          </button>
          <button
            className={`filter-btn ${statusFilter === 'offline' ? 'active' : ''}`}
            onClick={() => setStatusFilter('offline')}
          >
            离线 <span className="filter-count">{offlineCount}</span>
          </button>
        </div>
        <div className="sort-group">
          <span className="sort-label">排序</span>
          {sortOptions.map(opt => (
            <button
              key={opt.field}
              className={`sort-btn ${sortField === opt.field ? 'active' : ''}`}
              onClick={() => handleSort(opt.field)}
            >
              {opt.label}
              {sortField === opt.field && (
                <span className="sort-dir">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="node-list">
        {sortedNodes.map(node => (
          <NodeCard
            key={node.uuid}
            node={node}
            isSelected={selectedUuid === node.uuid}
            isExpanded={expandedUuid === node.uuid}
            barPercent={Math.min(((node.totalUpload + node.totalDownload) / maxTotal) * 100, 100)}
            onSelect={onSelect}
            onToggleExpand={() => setExpandedUuid(expandedUuid === node.uuid ? null : node.uuid)}
          />
        ))}
      </div>
    </div>
  )
}

interface NodeCardProps {
  node: NodeTraffic
  isSelected: boolean
  isExpanded: boolean
  barPercent: number
  onSelect: (uuid: string | null) => void
  onToggleExpand: () => void
}

function NodeCard({ node, isSelected, isExpanded, barPercent, onSelect, onToggleExpand }: NodeCardProps) {
  const total = node.totalUpload + node.totalDownload

  return (
    <div
      className={`node-card ${isSelected ? 'selected' : ''} ${!node.online ? 'offline' : ''}`}
      onClick={() => onSelect(isSelected ? null : node.uuid)}
    >
      <div className="card-body">
        <div className="card-identity">
          <span className={`status-dot ${node.online ? 'online' : 'offline'}`} />
          <div className="identity-info">
            <span className="node-name">{node.name}</span>
            <div className="identity-meta">
              {node.region && <span className="meta-tag">{node.region}</span>}
              {node.ipv4 && <span className="meta-ip">{node.ipv4}</span>}
            </div>
          </div>
        </div>

        <div className="card-speed">
          {node.online ? (
            <div className="speed-badges">
              <span className="speed-badge up">↑ {formatSpeed(node.currentOut)}</span>
              <span className="speed-badge down">↓ {formatSpeed(node.currentIn)}</span>
            </div>
          ) : (
            <span className="speed-offline">离线</span>
          )}
        </div>

        <div className="card-traffic">
          <span className="traffic-val up">↑ {formatBytes(node.totalUpload)}</span>
          <span className="traffic-val down">↓ {formatBytes(node.totalDownload)}</span>
          <span className="traffic-val total">= {formatBytes(total)}</span>
        </div>

        <div className="card-bar">
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${barPercent}%` }} />
          </div>
          <span className="bar-label">{barPercent.toFixed(1)}%</span>
        </div>

        <button
          className={`expand-btn ${isExpanded ? 'open' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleExpand() }}
          title={isExpanded ? '收起详情' : '展开详情'}
        >
          <span className="expand-arrow">›</span>
        </button>
      </div>

      {isExpanded && (
        <div className="card-detail">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">IPv4</span>
              <span className="detail-value mono">{node.ipv4 || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">IPv6</span>
              <span className="detail-value mono">{node.ipv6 || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">区域</span>
              <span className="detail-value">{node.region || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">状态</span>
              <span className={`detail-value ${node.online ? 'text-online' : 'text-offline'}`}>
                {node.online ? '在线' : '离线'}
              </span>
            </div>
          </div>
          {node.dailyTraffic.length > 0 && (
            <div className="detail-daily">
              <h4>每日明细</h4>
              <div className="daily-list">
                {[...node.dailyTraffic].reverse().map(d => (
                  <div key={d.date} className="daily-item">
                    <span className="daily-date mono">{formatDateFull(d.date)}</span>
                    <span className="daily-upload mono">↑ {formatBytesShort(d.upload)}</span>
                    <span className="daily-download mono">↓ {formatBytesShort(d.download)}</span>
                    <span className="daily-total mono">= {formatBytesShort(d.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { getNodes, getNodesLatestStatus } from '../rpc'
import { formatBytes, formatSpeed } from '../utils'
import type { Client, NodeStatus } from '../types'
import './ManagePage.css'

/**
 * 节点管理条目（扩展 group 和排序信息）
 */
interface ManageNode {
  uuid: string
  name: string
  ipv4: string
  ipv6: string
  region: string
  group: string
  online: boolean
  currentIn: number
  currentOut: number
  totalUpload: number
  totalDownload: number
}

/**
 * 列显示配置
 * @property key - 数据字段名
 * @property label - 列标题
 * @property visible - 是否可见
 */
interface ColumnConfig {
  key: string
  label: string
  visible: boolean
}

/**
 * 默认列配置
 */
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'status', label: '状态', visible: true },
  { key: 'name', label: '节点', visible: true },
  { key: 'ip', label: 'IP', visible: true },
  { key: 'group', label: '分组', visible: true },
  { key: 'region', label: '区域', visible: true },
  { key: 'speed', label: '实时速度', visible: true },
  { key: 'upload', label: '上传', visible: true },
  { key: 'download', label: '下载', visible: true },
  { key: 'total', label: '合计', visible: true },
]

/**
 * 节点管理页面
 * 支持按分组折叠展开、拖拽排序、自定义列显示
 */
export default function ManagePage() {
  const [nodes, setNodes] = useState<ManageNode[]>([])
  const [loading, setLoading] = useState(false)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('komari-columns')
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS
  })
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragNodeRef = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem('komari-columns', JSON.stringify(columns))
  }, [columns])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [nodesMap, statusMap] = await Promise.all([
        getNodes(),
        getNodesLatestStatus().catch(() => ({})),
      ])
      const entries = Object.entries(nodesMap as Record<string, Client>)
      const results: ManageNode[] = entries.map(([uuid, info]) => {
        const status = (statusMap as Record<string, NodeStatus>)[uuid]
        return {
          uuid,
          name: info.name || uuid.slice(0, 8),
          ipv4: info.ipv4 || '',
          ipv6: info.ipv6 || '',
          region: info.region || '',
          group: info.group || '默认',
          online: status?.online ?? false,
          currentIn: status?.net_in ?? 0,
          currentOut: status?.net_out ?? 0,
          totalUpload: status?.net_total_up ?? 0,
          totalDownload: status?.net_total_down ?? 0,
        }
      })
      setNodes(results)
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /**
   * 按分组归类节点
   */
  const groupedNodes = (() => {
    const map = new Map<string, ManageNode[]>()
    for (const node of nodes) {
      const group = node.group || '默认'
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(node)
    }
    return map
  })()

  /**
   * 获取扁平化的节点列表（按分组顺序）
   */
  const flatNodes = (() => {
    const result: ManageNode[] = []
    for (const [, groupNodes] of groupedNodes) {
      result.push(...groupNodes)
    }
    return result
  })()

  /**
   * 切换分组的折叠状态
   */
  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  /**
   * 切换列可见性
   */
  const toggleColumn = (key: string) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c))
  }

  /**
   * 重置列配置
   */
  const resetColumns = () => {
    setColumns(DEFAULT_COLUMNS)
    localStorage.removeItem('komari-columns')
  }

  /**
   * 拖拽开始
   */
  const handleDragStart = (idx: number) => {
    setDragIdx(idx)
    dragNodeRef.current = idx
  }

  /**
   * 拖拽经过
   */
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  /**
   * 拖拽放下，执行排序
   */
  const handleDrop = (targetIdx: number) => {
    if (dragNodeRef.current === null || dragNodeRef.current === targetIdx) {
      setDragIdx(null)
      setDragOverIdx(null)
      return
    }
    const sourceIdx = dragNodeRef.current
    const reordered = [...flatNodes]
    const [moved] = reordered.splice(sourceIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    setNodes(reordered)
    setDragIdx(null)
    setDragOverIdx(null)
    dragNodeRef.current = null
  }

  const visibleColumns = columns.filter(c => c.visible)
  const colCount = visibleColumns.length + 1

  return (
    <div className="manage-page">
      <div className="manage-toolbar">
        <button className="toolbar-btn" onClick={() => fetchData()}>
          ↻ 刷新
        </button>
        <div className="column-picker-wrap">
          <button
            className="toolbar-btn"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
          >
            ☰ 列设置
          </button>
          {showColumnPicker && (
            <div className="column-picker">
              {columns.map(col => (
                <label key={col.key} className="column-check">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
              <button className="reset-columns-btn" onClick={resetColumns}>
                重置默认
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="manage-empty">加载中...</div>
      ) : (
        <div className="manage-groups">
          {Array.from(groupedNodes.entries()).map(([group, groupNodes]) => {
            const isCollapsed = collapsedGroups.has(group)
            const onlineCount = groupNodes.filter(n => n.online).length
            return (
              <div key={group} className="group-section">
                <div
                  className="group-header"
                  onClick={() => toggleGroup(group)}
                >
                  <span className={`group-arrow ${isCollapsed ? '' : 'open'}`}>▸</span>
                  <span className="group-name">{group}</span>
                  <span className="group-meta">{groupNodes.length} 节点 · {onlineCount} 在线</span>
                </div>
                {!isCollapsed && (
                  <table className="manage-table">
                    <thead>
                      <tr>
                        <th className="drag-col"></th>
                        {visibleColumns.map(col => (
                          <th key={col.key}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupNodes.map(node => {
                        const globalIdx = flatNodes.indexOf(node)
                        return (
                          <tr
                            key={node.uuid}
                            className={`manage-row ${dragIdx === globalIdx ? 'dragging' : ''} ${dragOverIdx === globalIdx ? 'drag-over' : ''} ${node.online ? '' : 'offline'}`}
                            draggable
                            onDragStart={() => handleDragStart(globalIdx)}
                            onDragOver={e => handleDragOver(e, globalIdx)}
                            onDrop={() => handleDrop(globalIdx)}
                            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                          >
                            <td className="drag-handle">⠿</td>
                            {visibleColumns.map(col => (
                              <td key={col.key}>
                                {renderCell(col.key, node)}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * 渲染单元格内容
 * @param key - 列字段名
 * @param node - 节点数据
 * @returns 单元格内容
 */
function renderCell(key: string, node: ManageNode): React.ReactNode {
  switch (key) {
    case 'status':
      return <span className={`status-dot ${node.online ? 'online' : 'offline'}`} />
    case 'name':
      return <span className="node-name">{node.name}</span>
    case 'ip':
      return <span className="mono">{node.ipv4 || '-'}</span>
    case 'group':
      return <span className="group-tag">{node.group || '默认'}</span>
    case 'region':
      return node.region || '-'
    case 'speed':
      return node.online ? (
        <div className="speed-info">
          <span className="speed-up">↑{formatSpeed(node.currentOut)}</span>
          <span className="speed-down">↓{formatSpeed(node.currentIn)}</span>
        </div>
      ) : <span className="speed-offline">离线</span>
    case 'upload':
      return <span className="mono upload">{formatBytes(node.totalUpload)}</span>
    case 'download':
      return <span className="mono download">{formatBytes(node.totalDownload)}</span>
    case 'total':
      return <span className="mono total">{formatBytes(node.totalUpload + node.totalDownload)}</span>
    default:
      return '-'
  }
}

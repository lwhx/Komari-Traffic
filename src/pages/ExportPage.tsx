import { useState, useEffect, useCallback, useMemo } from 'react'
import { getNodes, getRecords } from '../rpc'
import { computeDailyTraffic, getLastNDays, formatBytes, formatDateFull, formatBytesShort } from '../utils'
import type { NodeTraffic, Client, DailyTraffic } from '../types'
import './ExportPage.css'

/**
 * 导出格式选项
 */
type ExportFormat = 'csv' | 'json'

/**
 * 导出维度选项
 */
type ExportScope = 'daily' | 'summary'

/**
 * 数据导出页面
 * 支持 CSV / JSON 格式导出，可按每日明细或汇总导出
 */
export default function ExportPage() {
  const [nodes, setNodes] = useState<NodeTraffic[]>([])
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(7)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [scope, setScope] = useState<ExportScope>('daily')
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set())
  const [exported, setExported] = useState(false)

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
      setSelectedUuids(new Set(results.map(n => n.uuid)))
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  /**
   * 切换节点选中
   */
  const toggleNode = (uuid: string) => {
    setSelectedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedUuids.size === nodes.length) setSelectedUuids(new Set())
    else setSelectedUuids(new Set(nodes.map(n => n.uuid)))
  }

  /**
   * 选中的节点列表
   */
  const selectedNodes = useMemo(
    () => nodes.filter(n => selectedUuids.has(n.uuid)),
    [nodes, selectedUuids],
  )

  /**
   * 导出预览数据（前5行）
   */
  const previewData = useMemo(() => {
    if (scope === 'summary') {
      return selectedNodes.map(n => ({
        节点名称: n.name,
        IPv4: n.ipv4 || '-',
        区域: n.region || '-',
        上传总量: formatBytes(n.totalUpload),
        下载总量: formatBytes(n.totalDownload),
        合计: formatBytes(n.totalUpload + n.totalDownload),
        统计天数: `${days}天`,
      }))
    }

    const rows: Record<string, string>[] = []
    for (const node of selectedNodes) {
      for (const d of node.dailyTraffic) {
        rows.push({
          节点名称: node.name,
          日期: formatDateFull(d.date),
          上传: formatBytesShort(d.upload),
          下载: formatBytesShort(d.download),
          合计: formatBytesShort(d.total),
        })
      }
    }
    return rows.slice(0, 10)
  }, [selectedNodes, scope, days])

  /**
   * 生成 CSV 内容
   */
  const generateCSV = (): string => {
    const BOM = '\uFEFF'
    if (scope === 'summary') {
      const header = '节点名称,IPv4,区域,上传总量,下载总量,合计,统计天数'
      const rows = selectedNodes.map(n =>
        `"${n.name}","${n.ipv4 || '-'}","${n.region || '-'}","${formatBytes(n.totalUpload)}","${formatBytes(n.totalDownload)}","${formatBytes(n.totalUpload + n.totalDownload)}","${days}天"`
      )
      return BOM + header + '\n' + rows.join('\n')
    }

    const header = '节点名称,日期,上传,下载,合计'
    const rows: string[] = []
    for (const node of selectedNodes) {
      for (const d of node.dailyTraffic) {
        rows.push(`"${node.name}","${formatDateFull(d.date)}","${formatBytesShort(d.upload)}","${formatBytesShort(d.download)}","${formatBytesShort(d.total)}"`)
      }
    }
    return BOM + header + '\n' + rows.join('\n')
  }

  /**
   * 生成 JSON 内容
   */
  const generateJSON = (): string => {
    if (scope === 'summary') {
      return JSON.stringify(selectedNodes.map(n => ({
        name: n.name,
        ipv4: n.ipv4 || null,
        region: n.region || null,
        totalUpload: n.totalUpload,
        totalDownload: n.totalDownload,
        total: n.totalUpload + n.totalDownload,
        days,
      })), null, 2)
    }

    const data: Array<Record<string, unknown>> = []
    for (const node of selectedNodes) {
      for (const d of node.dailyTraffic) {
        data.push({
          node: node.name,
          date: d.date,
          upload: d.upload,
          download: d.download,
          total: d.total,
        })
      }
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * 执行导出：生成文件并触发下载
   */
  const handleExport = () => {
    const content = format === 'csv' ? generateCSV() : generateJSON()
    const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
    const ext = format === 'csv' ? 'csv' : 'json'
    const dateStr = new Date().toISOString().slice(0, 10)

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `komari-traffic-${scope}-${dateStr}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  /**
   * 导出数据总行数
   */
  const totalRows = useMemo(() => {
    if (scope === 'summary') return selectedNodes.length
    return selectedNodes.reduce((s, n) => s + n.dailyTraffic.length, 0)
  }, [selectedNodes, scope])

  return (
    <div className="export-page">
      <div className="export-config">
        <div className="config-card">
          <h3 className="config-title">导出设置</h3>

          <div className="config-row">
            <label className="config-label">时间范围</label>
            <div className="interval-btns">
              {[7, 14, 30].map(d => (
                <button key={d} className={`interval-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
                  {d}天
                </button>
              ))}
            </div>
          </div>

          <div className="config-row">
            <label className="config-label">导出格式</label>
            <div className="interval-btns">
              <button className={`interval-btn ${format === 'csv' ? 'active' : ''}`} onClick={() => setFormat('csv')}>CSV</button>
              <button className={`interval-btn ${format === 'json' ? 'active' : ''}`} onClick={() => setFormat('json')}>JSON</button>
            </div>
          </div>

          <div className="config-row">
            <label className="config-label">数据维度</label>
            <div className="interval-btns">
              <button className={`interval-btn ${scope === 'daily' ? 'active' : ''}`} onClick={() => setScope('daily')}>每日明细</button>
              <button className={`interval-btn ${scope === 'summary' ? 'active' : ''}`} onClick={() => setScope('summary')}>节点汇总</button>
            </div>
          </div>

          <div className="config-row">
            <label className="config-label">
              选择节点 ({selectedUuids.size}/{nodes.length})
            </label>
            <button className="toggle-all-btn" onClick={toggleAll}>
              {selectedUuids.size === nodes.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div className="node-check-grid">
            {nodes.map(node => (
              <label key={node.uuid} className={`export-check ${selectedUuids.has(node.uuid) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedUuids.has(node.uuid)}
                  onChange={() => toggleNode(node.uuid)}
                />
                {node.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="export-preview">
        <div className="preview-card">
          <div className="preview-header">
            <h3 className="config-title">导出预览</h3>
            <span className="preview-info">{totalRows} 条记录 · {format.toUpperCase()}</span>
          </div>

          {previewData.length > 0 ? (
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    {Object.keys(previewData[0]).map(key => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, i) => (
                        <td key={i}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {scope === 'daily' && totalRows > 10 && (
                <div className="preview-more">... 还有 {totalRows - 10} 条记录</div>
              )}
            </div>
          ) : (
            <div className="preview-empty">请选择节点查看预览</div>
          )}

          <div className="export-actions">
            <button
              className={`export-btn ${exported ? 'done' : ''}`}
              onClick={handleExport}
              disabled={selectedUuids.size === 0}
            >
              {exported ? '✓ 已导出' : `导出 ${format.toUpperCase()} 文件`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

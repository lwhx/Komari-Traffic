import type { DailyTraffic, NodeTraffic, StatusRecord } from './types'

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const k = 1024
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(2)} ${units[i]}`
}

export function formatBytesShort(bytes: number): string {
  if (bytes === 0) return '0'
  const units = ['B', 'K', 'M', 'G', 'T']
  const k = 1024
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(1)}${units[i]}`
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const k = 1024
  const i = Math.floor(Math.log(Math.abs(bytesPerSec)) / Math.log(k))
  const value = bytesPerSec / Math.pow(k, i)
  return `${value.toFixed(1)} ${units[i]}`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

function getDateKey(isoString: string): string {
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function computeDailyTraffic(records: StatusRecord[]): DailyTraffic[] {
  if (records.length === 0) return []

  const sorted = [...records].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  )

  const dayMap = new Map<string, { firstUp: number; firstDown: number; lastUp: number; lastDown: number }>()

  for (const r of sorted) {
    const key = getDateKey(r.time)
    if (!dayMap.has(key)) {
      dayMap.set(key, {
        firstUp: r.net_total_up,
        firstDown: r.net_total_down,
        lastUp: r.net_total_up,
        lastDown: r.net_total_down,
      })
    } else {
      const entry = dayMap.get(key)!
      entry.lastUp = r.net_total_up
      entry.lastDown = r.net_total_down
    }
  }

  const days: DailyTraffic[] = []
  for (const [date, entry] of dayMap) {
    let up = entry.lastUp - entry.firstUp
    let down = entry.lastDown - entry.firstDown
    if (up < 0) up = entry.lastUp
    if (down < 0) down = entry.lastDown
    days.push({
      date,
      upload: up,
      download: down,
      total: up + down,
    })
  }

  days.sort((a, b) => a.date.localeCompare(b.date))
  return days
}

function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}Z`
}

export function getLastNDays(n: number): { start: string; end: string } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - n + 1)
  start.setHours(0, 0, 0, 0)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export function sumAllNodesTraffic(nodes: NodeTraffic[]): DailyTraffic[] {
  const map = new Map<string, DailyTraffic>()
  for (const node of nodes) {
    for (const d of node.dailyTraffic) {
      if (!map.has(d.date)) {
        map.set(d.date, { date: d.date, upload: 0, download: 0, total: 0 })
      }
      const entry = map.get(d.date)!
      entry.upload += d.upload
      entry.download += d.download
      entry.total += d.total
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function getTodayTraffic(nodes: NodeTraffic[]): { upload: number; download: number } {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let upload = 0
  let download = 0
  for (const node of nodes) {
    const todayData = node.dailyTraffic.find(d => d.date === today)
    if (todayData) {
      upload += todayData.upload
      download += todayData.download
    }
  }
  return { upload, download }
}

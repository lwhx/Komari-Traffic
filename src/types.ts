export interface Client {
  uuid: string
  name: string
  ipv4: string
  ipv6: string
  region: string
  os: string
  arch: string
  mem_total: number
  disk_total: number
  hidden: boolean
  group: string
}

export interface StatusRecord {
  client: string
  time: string
  cpu: number
  gpu: number
  ram: number
  ram_total: number
  swap: number
  swap_total: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  disk_total: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  process: number
  connections: number
  connections_udp: number
}

export interface NodeStatus {
  online: boolean
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  cpu: number
  ram: number
  ram_total: number
  disk: number
  disk_total: number
}

export interface DailyTraffic {
  date: string
  upload: number
  download: number
  total: number
}

export interface NodeTraffic {
  uuid: string
  name: string
  ipv4: string
  ipv6: string
  region: string
  online: boolean
  currentIn: number
  currentOut: number
  dailyTraffic: DailyTraffic[]
  totalUpload: number
  totalDownload: number
}

export interface RpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown> | unknown[]
  id: number
}

export interface RpcResponse<T> {
  jsonrpc: '2.0'
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
  id: number
}

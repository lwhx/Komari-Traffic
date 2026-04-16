import type { RpcRequest, RpcResponse, StatusRecord, NodeStatus } from './types'

let rpcId = 0

export async function rpcCall<T>(method: string, params?: Record<string, unknown> | unknown[]): Promise<T> {
  const request: RpcRequest = {
    jsonrpc: '2.0',
    method,
    id: ++rpcId,
  }
  if (params !== undefined) {
    request.params = params
  }

  const apiUrl = import.meta.env.VITE_KOMARI_URL || ''
  const response = await fetch(`${apiUrl}/api/rpc2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data: RpcResponse<T> = await response.json()

  if (data.error) {
    throw new Error(`RPC Error [${data.error.code}]: ${data.error.message}`)
  }

  return data.result as T
}

// 模拟节点数据
export async function getNodes(): Promise<Record<string, import('./types').Client>> {
  try {
    return await rpcCall<Record<string, import('./types').Client>>('common:getNodes')
  } catch (error) {
    console.warn('无法连接到后端 API，使用模拟数据', error)
    // 返回模拟数据
    return {
      'node1': {
        uuid: 'node1',
        name: '节点 1',
        ipv4: '192.168.1.1',
        ipv6: '::1',
        region: '北京',
        os: 'Ubuntu 22.04',
        arch: 'x86_64',
        mem_total: 8192,
        disk_total: 100000,
        hidden: false,
        group: '默认'
      },
      'node2': {
        uuid: 'node2',
        name: '节点 2',
        ipv4: '192.168.1.2',
        ipv6: '::2',
        region: '上海',
        os: 'CentOS 7',
        arch: 'x86_64',
        mem_total: 16384,
        disk_total: 200000,
        hidden: false,
        group: '默认'
      },
      'node3': {
        uuid: 'node3',
        name: '节点 3',
        ipv4: '192.168.1.3',
        ipv6: '::3',
        region: '广州',
        os: 'Debian 11',
        arch: 'x86_64',
        mem_total: 4096,
        disk_total: 50000,
        hidden: false,
        group: '默认'
      }
    }
  }
}

// 模拟节点状态数据
export async function getNodesLatestStatus(): Promise<Record<string, NodeStatus>> {
  try {
    const raw = await rpcCall<Record<string, {
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
    }>>('common:getNodesLatestStatus')

    return raw
  } catch (error) {
    console.warn('无法连接到后端 API，使用模拟数据', error)
    // 返回模拟数据
    return {
      'node1': {
        online: true,
        net_in: 1024,
        net_out: 2048,
        net_total_up: 1024000,
        net_total_down: 2048000,
        cpu: 50,
        ram: 4096,
        ram_total: 8192,
        disk: 50000,
        disk_total: 100000
      },
      'node2': {
        online: true,
        net_in: 2048,
        net_out: 4096,
        net_total_up: 2048000,
        net_total_down: 4096000,
        cpu: 30,
        ram: 8192,
        ram_total: 16384,
        disk: 100000,
        disk_total: 200000
      },
      'node3': {
        online: false,
        net_in: 0,
        net_out: 0,
        net_total_up: 512000,
        net_total_down: 1024000,
        cpu: 0,
        ram: 0,
        ram_total: 4096,
        disk: 25000,
        disk_total: 50000
      }
    }
  }
}

interface RawRecordsResult {
  count: number
  records: Record<string, StatusRecord[]>
  from: string
  to: string
  load_type?: string
}

// 模拟流量记录数据
export async function getRecords(
  uuid: string,
  start: string,
  end: string,
): Promise<StatusRecord[]> {
  try {
    const result = await rpcCall<RawRecordsResult>('common:getRecords', {
      type: 'load',
      uuid,
      start,
      end,
      load_type: 'network',
      maxCount: -1,
    })

    const recordsMap = result.records
    if (Array.isArray(recordsMap)) {
      return recordsMap
    }
    if (recordsMap && typeof recordsMap === 'object') {
      return recordsMap[uuid] || []
    }
    return []
  } catch (error) {
    console.warn('无法连接到后端 API，使用模拟数据', error)
    // 返回模拟数据
    const records: StatusRecord[] = []
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      for (let h = 0; h < 24; h++) {
        records.push({
          client: uuid,
          time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0).toISOString(),
          cpu: Math.random() * 100,
          gpu: Math.random() * 100,
          ram: Math.random() * 8192,
          ram_total: 8192,
          swap: Math.random() * 4096,
          swap_total: 4096,
          load: Math.random() * 10,
          load5: Math.random() * 10,
          load15: Math.random() * 10,
          temp: 30 + Math.random() * 20,
          disk: Math.random() * 50000,
          disk_total: 100000,
          net_in: Math.random() * 10240,
          net_out: Math.random() * 10240,
          net_total_up: 1000000 + Math.random() * 1000000,
          net_total_down: 2000000 + Math.random() * 2000000,
          process: 100 + Math.random() * 100,
          connections: 500 + Math.random() * 500,
          connections_udp: 200 + Math.random() * 200
        })
      }
    }
    
    return records
  }
}

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

  const response = await fetch('/api/rpc2', {
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

export async function getNodes(): Promise<Record<string, import('./types').Client>> {
  return rpcCall<Record<string, import('./types').Client>>('common:getNodes')
}

export async function getNodesLatestStatus(): Promise<Record<string, NodeStatus>> {
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
}

interface RawRecordsResult {
  count: number
  records: Record<string, StatusRecord[]>
  from: string
  to: string
  load_type?: string
}

export async function getRecords(
  uuid: string,
  start: string,
  end: string,
): Promise<StatusRecord[]> {
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
}

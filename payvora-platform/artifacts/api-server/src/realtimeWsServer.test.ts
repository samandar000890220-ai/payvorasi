import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { createServer } from 'http'
import { attachRealtimeWsServer } from './realtimeWsServer'
import WebSocket from 'ws'

let server: ReturnType<typeof createServer>
let port: number
let wss: any

beforeEach(async () => {
  server = createServer((req, res) => { res.statusCode = 404; res.end() })
  wss = await attachRealtimeWsServer(server)
  await new Promise<void>((resolve) => { server.listen(0, () => { port = (server.address() as any).port; resolve() }) })
})

afterEach(async () => {
  try { wss.close() } catch {}
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('realtime ws returns provider_not_configured when env missing', async () => {
  // Ensure env is unset for test
  delete (process.env as any).REALTIME_PROVIDER_WS_URL
  const url = `ws://127.0.0.1:${port}/api/realtime/voice`
  const ws = new WebSocket(url)
  const msg = await new Promise<any>((resolve, reject) => {
    ws.on('message', (data: any) => { try { resolve(JSON.parse(data.toString())) } catch (e) { reject(e) } })
    ws.on('error', (err: any) => reject(err))
    setTimeout(() => reject(new Error('timeout waiting for message')), 3000)
  })
  assert.strictEqual(msg.type, 'error')
  assert.strictEqual(msg.code, 'provider_not_configured')
  ws.close()
})

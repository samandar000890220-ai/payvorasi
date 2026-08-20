import { createServer } from 'http'
import WebSocket from 'ws'
import { attachRealtimeWsServer } from './realtimeWsServer'

async function waitForMessage(ws: any, timeout = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { reject(new Error('timeout')) }, timeout)
    ws.once('message', (data: any) => {
      clearTimeout(t)
      try { resolve(JSON.parse(data.toString())) } catch { resolve(data.toString()) }
    })
  })
}

async function run() {
  process.env['REALTIME_PROVIDER'] = 'loopback'
  const server = createServer()
  const wss = await attachRealtimeWsServer(server)
  await new Promise<void>((r) => server.listen(0, () => r()))
  const port = (server.address() as any).port
  const url = `ws://127.0.0.1:${port}/api/realtime/voice`
  const ws: any = new WebSocket(url)
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve())
    ws.on('error', (err: any) => reject(err))
  })

  // Start a session
  ws.send(JSON.stringify({ type: 'session.start' }))
  const created = await waitForMessage(ws, 2000)
  console.log('session.created ->', created)
  if (created.type !== 'session.created') throw new Error('expected session.created')

  // send speech.end to trigger loopback provider sequence
  ws.send(JSON.stringify({ type: 'speech.end' }))

  // Expect speech.partial, speech.final, response.text.completed, response.audio, response.ended
  const msgs: any[] = []
  for (let i = 0; i < 5; i++) {
    const m = await waitForMessage(ws, 2000)
    console.log('got ->', m)
    msgs.push(m)
  }

  ws.close()
  server.close()
  console.log('LOOPBACK TEST OK')
}

run().catch((err) => { console.error('LOOPBACK TEST FAILED', err); process.exit(1) })

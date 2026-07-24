import { tokens } from './api'

// Reconnecting WebSocket. onEvent receives parsed JSON messages, plus synthetic
// { event: '_open' } / { event: '_close' } lifecycle notifications.
export function openSocket(path, onEvent) {
  let ws
  let closed = false
  let retry = 0
  let heartbeat = null

  const url = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}${path}?token=${tokens.access || ''}`
  }

  const connect = () => {
    ws = new WebSocket(url())
    ws.onopen = () => {
      retry = 0
      onEvent?.({ event: '_open' })
      // Keep the connection alive (some proxies drop idle WebSockets).
      clearInterval(heartbeat)
      heartbeat = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'ping' }))
      }, 25000)
    }
    ws.onmessage = (e) => {
      try { onEvent?.(JSON.parse(e.data)) } catch { /* ignore */ }
    }
    ws.onclose = () => {
      clearInterval(heartbeat)
      onEvent?.({ event: '_close' })
      if (!closed) {
        retry += 1
        setTimeout(connect, Math.min(800 * retry, 5000))
      }
    }
    ws.onerror = () => { try { ws.close() } catch { /* ignore */ } }
  }

  connect()

  return {
    send: (obj) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)) },
    close: () => { closed = true; try { ws?.close() } catch { /* ignore */ } },
  }
}

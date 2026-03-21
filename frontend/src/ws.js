/**
 * WebSocket client for real-time station updates.
 */

let ws = null;
let listeners = [];
let reconnectTimer = null;

export function connectWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    console.log('🔌 WebSocket connected');
    // Heartbeat
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 30000);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'pong') return;
      listeners.forEach(fn => fn(msg));
    } catch (e) { /* ignore parse errors */ }
  };

  ws.onclose = () => {
    console.log('🔌 WebSocket disconnected, reconnecting...');
    reconnectTimer = setTimeout(connectWS, 3000);
  };

  ws.onerror = () => ws.close();
}

export function onWSMessage(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function disconnectWS() {
  clearTimeout(reconnectTimer);
  if (ws) ws.close();
  ws = null;
  listeners = [];
}

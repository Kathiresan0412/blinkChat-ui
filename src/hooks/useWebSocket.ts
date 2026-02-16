'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWebSocketUrl } from '@/lib/ws';
import type { WSMessage } from '@/lib/ws';

type SendMessage = { type: 'chat'; message: string } | { type: 'signal'; payload: unknown } | { type: 'next' };

export function useWebSocket(token: string | null) {
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((msg: SendMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    const url = getWebSocketUrl();
    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus('open');
    ws.onclose = () => {
      setStatus('closed');
      wsRef.current = null;
    };
    ws.onerror = () => setStatus('error');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        setLastMessage(data);
      } catch {
        // ignore
      }
    };

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [token]);

  return { lastMessage, setLastMessage, status, send };
}

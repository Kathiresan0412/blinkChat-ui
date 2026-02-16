/**
 * WebSocket URL for chat: derived from API URL (http(s) -> ws(s), add path).
 */
export function getWebSocketUrl(path = '/ws/chat/'): string {
  if (typeof window === 'undefined') {
    const base = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = base.replace(/^http/, 'ws');
    return `${url.replace(/\/$/, '')}${path}`;
  }
  const base = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const url = base.replace(/^http/, 'ws');
  return `${url.replace(/\/$/, '')}${path}`;
}

export type WSMessage =
  | { type: 'connected'; user?: { user_id: number; username: string; display_name: string } }
  | { type: 'waiting'; message?: string }
  | { type: 'matched'; session_id: string; partner: { user_id: string; username: string; display_name?: string }; is_initiator?: boolean }
  | { type: 'chat'; message: string; sender_id: string }
  | { type: 'signal'; payload: RTCSignal }
  | { type: 'partner_next' }
  | { type: 'partner_left' };

export type RTCSignal = { type: 'offer'; sdp: string } | { type: 'answer'; sdp: string } | { type: 'ice'; candidate: RTCIceCandidateInit };

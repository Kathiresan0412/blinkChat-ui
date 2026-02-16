/**
 * WebSocket URL for chat. Uses NEXT_PUBLIC_WS_URL if set; otherwise derives from
 * API URL using origin only (so /api prefix is not used for WS). Backend serves
 * WebSocket at /ws/chat/ on the same host as the API.
 */
export function getWebSocketUrl(path = '/ws/chat/'): string {
  const base = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const parsed = new URL(base.startsWith('ws') ? base.replace(/^ws/, 'http') : base);
  const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsOrigin = `${wsProtocol}//${parsed.host}`;
  return `${wsOrigin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export type WSMessage =
  | { type: 'connected'; user?: { user_id: number; username: string; display_name: string } }
  | { type: 'waiting'; message?: string }
  | { type: 'matched'; session_id: string; partner: { user_id: string; username: string; display_name?: string; age?: string; country?: string }; is_initiator?: boolean }
  | { type: 'chat'; message: string; sender_id: string }
  | { type: 'signal'; payload: RTCSignal }
  | { type: 'partner_next' }
  | { type: 'partner_left' };

export type RTCSignal = { type: 'offer'; sdp: string } | { type: 'answer'; sdp: string } | { type: 'ice'; candidate: RTCIceCandidateInit };

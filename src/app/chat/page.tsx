'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import type { WSMessage, RTCSignal } from '@/lib/ws';
import { createReport } from '@/lib/api';

type ChatEntry = { id: string; text: string; self: boolean };

const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'underage', label: 'Underage' },
  { value: 'other', label: 'Other' },
];

export default function ChatPage() {
  const [token, setToken] = useState<string | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') setToken(localStorage.getItem('blinkchat_token'));
  }, []);

  const disconnectAndRequeue = useCallback(() => {
    setReconnectKey((k) => k + 1);
  }, []);

  return (
    <ChatContent
      key={reconnectKey}
      token={token}
      onRequeue={disconnectAndRequeue}
    />
  );
}

function ChatContent({
  token,
  onRequeue,
}: {
  token: string | null;
  onRequeue: () => void;
}) {
  const [partner, setPartner] = useState<{ user_id: string; username: string; display_name?: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'matched'>('idle');
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('other');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendSignal = useRef<(p: RTCSignal) => void>(() => {});
  const { lastMessage, setLastMessage, status, send } = useWebSocket(token);
  const {
    localStream,
    remoteStream,
    error: webrtcError,
    startLocalStream,
    createPeerConnection,
    handleSignal,
    stop: stopWebRTC,
  } = useWebRTC((payload) => {
    send({ type: 'signal', payload });
  });
  sendSignal.current = (payload) => send({ type: 'signal', payload });

  const disconnectAndRequeue = useCallback(() => {
    stopWebRTC();
    setPartner(null);
    setSessionId(null);
    setPhase('idle');
    setMessages([]);
    setLastMessage(null);
    onRequeue();
  }, [onRequeue, setLastMessage, stopWebRTC]);

  useEffect(() => {
    const msg = lastMessage;
    if (!msg) return;

    if (msg.type === 'connected') {
      setPhase('waiting');
    } else if (msg.type === 'waiting') {
      setPhase('waiting');
    } else if (msg.type === 'matched') {
      setPartner(msg.partner);
      setSessionId(msg.session_id);
      setPhase('matched');
      setMessages([]);
      const isInitiator = msg.is_initiator !== false;
      startLocalStream().then((stream) => {
        if (stream) createPeerConnection(stream, isInitiator);
      });
    } else if (msg.type === 'chat') {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-${prev.length}`, text: msg.message, self: false },
      ]);
    } else if (msg.type === 'signal') {
      handleSignal(msg.payload, localStream ?? null);
    } else if (msg.type === 'partner_next' || msg.type === 'partner_left') {
      disconnectAndRequeue();
    }
  }, [lastMessage, startLocalStream, createPeerConnection, handleSignal, localStream, disconnectAndRequeue, setLastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNext = () => {
    send({ type: 'next' });
    disconnectAndRequeue();
  };

  const sendChat = () => {
    const t = chatInput.trim();
    if (!t) return;
    send({ type: 'chat', message: t });
    setMessages((prev) => [...prev, { id: `self-${Date.now()}`, text: t, self: true }]);
    setChatInput('');
  };

  const submitReport = async () => {
    if (!token || !partner) return;
    setReportSending(true);
    try {
      await createReport(token, Number(partner.user_id), reportReason, reportDesc, sessionId ?? undefined);
      setReportOpen(false);
      setReportDesc('');
    } catch (e) {
      console.error(e);
    } finally {
      setReportSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-amber-500">
          BlinkChat
        </Link>
        <div className="flex items-center gap-2">
          {status === 'open' && phase === 'waiting' && (
            <span className="text-sm text-zinc-500">Looking for someone...</span>
          )}
          {phase === 'matched' && partner && (
            <span className="text-sm text-zinc-400">
              {partner.display_name || partner.username || 'Stranger'}
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-zinc-400">Connecting...</p>
          </div>
        )}

        {phase === 'waiting' && status === 'open' && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-full bg-amber-500/30" />
            <p className="text-zinc-400">Looking for someone to chat with...</p>
          </div>
        )}

        {phase === 'matched' && (
          <div className="flex w-full max-w-4xl flex-1 flex-col gap-4 lg:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-900">
                <video
                  ref={(el) => {
                    if (el && remoteStream) {
                      el.srcObject = remoteStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted={false}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/90 shadow-lg">
                  <video
                    ref={(el) => {
                      if (el && localStream) {
                        el.srcObject = localStream;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="h-24 w-32 object-cover"
                  />
                </div>
              </div>
              {webrtcError && (
                <p className="text-sm text-amber-500">Video/audio: {webrtcError}</p>
              )}
            </div>

            <div className="flex w-80 flex-col rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="flex min-h-[120px] flex-1 flex-col space-y-2 overflow-y-auto p-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-1.5 text-sm ${m.self ? 'ml-8 bg-amber-500/20 text-right' : 'mr-8 bg-zinc-800 text-left'}`}
                  >
                    {m.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2 border-t border-zinc-800 p-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'matched' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleNext}
              className="rounded-full bg-amber-500 px-6 py-2.5 font-semibold text-zinc-950 hover:bg-amber-400"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="rounded-full border border-zinc-600 px-6 py-2.5 font-medium text-zinc-400 hover:bg-zinc-800"
            >
              Report
            </button>
          </div>
        )}
      </main>

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Report user</h3>
            {!token ? (
              <p className="text-sm text-zinc-400">
                <Link href="/login" className="text-amber-500 hover:underline">Sign in</Link> to report.
              </p>
            ) : (
              <>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <textarea
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder="Optional details"
                  rows={2}
                  className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="flex-1 rounded-lg border border-zinc-600 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitReport}
                    disabled={reportSending}
                    className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {reportSending ? 'Sending...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

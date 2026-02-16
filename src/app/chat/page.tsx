'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import type {RTCSignal } from '@/lib/ws';
import { createReport } from '@/lib/api';

type ChatEntry = { id: string; text: string; self: boolean };

const PROFILE_STORAGE_KEY = 'blinkchat_profile';

type Profile = { name: string; age: string; country?: string };

function getStoredProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { name?: string; age?: string; country?: string };
    if (typeof data?.name === 'string' && data.name.trim() && typeof data?.age === 'string' && data.age.trim()) {
      return {
        name: data.name.trim(),
        age: data.age.trim(),
        country: typeof data?.country === 'string' && data.country.trim() ? data.country.trim() : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function saveProfileToStorage(profile: Profile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/** Fetch country name by client IP (HTTPS, no API key). */
async function fetchCountryByIp(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { country_name?: string; error?: boolean };
    if (data?.error || !data?.country_name) return '';
    return String(data.country_name).trim() || '';
  } catch {
    return '';
  }
}

const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'underage', label: 'Underage' },
  { value: 'other', label: 'Other' },
];

export default function ChatPage() {
  // Initialize as null so SSR and first client render match; then sync from localStorage in useEffect
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    const stored = getStoredProfile();
    if (stored) {
      const t = setTimeout(() => setProfile(stored), 0);
      return () => clearTimeout(t);
    }
  }, []);

  const disconnectAndRequeue = useCallback(() => {
    setReconnectKey((k) => k + 1);
  }, []);

  if (profile === null) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
        <header className="flex items-center border-b border-zinc-800 px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-amber-500">
            BlinkChat
          </Link>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <IntroForm
            onSubmit={async (name, age) => {
              const country = await fetchCountryByIp();
              const p = { name: name.trim(), age: age.trim(), country: country || 'Unknown' };
              saveProfileToStorage(p);
              setProfile(p);
            }}
          />
        </main>
      </div>
    );
  }

  if (!profile.country) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
        <header className="flex items-center border-b border-zinc-800 px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-amber-500">
            BlinkChat
          </Link>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <DetectingCountry
            profile={profile}
            onDone={(p) => {
              saveProfileToStorage(p);
              setProfile(p);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <ChatContent
      key={reconnectKey}
      token={null}
      profile={profile}
      onRequeue={disconnectAndRequeue}
    />
  );
}

function DetectingCountry({ profile, onDone }: { profile: Profile; onDone: (p: Profile & { country: string }) => void }) {
  useEffect(() => {
    let cancelled = false;
    fetchCountryByIp().then((country) => {
      if (!cancelled) onDone({ ...profile, country: country || 'Unknown' });
    });
    return () => { cancelled = true; };
    // Run once on mount; profile/onDone from initial render are intended
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 rounded-full border-2 border-amber-500/50 border-t-amber-500 animate-spin" />
      <p className="text-zinc-400 text-sm">Detecting your country...</p>
    </div>
  );
}

function IntroForm({ onSubmit }: { onSubmit: (name: string, age: string) => void | Promise<void> }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const a = age.trim();
    if (!n) {
      setError('Please enter your name.');
      return;
    }
    const ageNum = parseInt(a, 10);
    if (a === '' || Number.isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      setError('Please enter a valid age (1–120).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSubmit(n, a);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-100">Welcome to BlinkChat</h1>
      <p className="mb-6 text-sm text-zinc-500">Tell us a bit about you before we find someone to chat with.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="intro-name" className="mb-1.5 block text-sm font-medium text-zinc-400">
            Your name
          </label>
          <input
            id="intro-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="intro-age" className="mb-1.5 block text-sm font-medium text-zinc-400">
            Your age
          </label>
          <input
            id="intro-age"
            type="number"
            min={1}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 25"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-amber-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? 'Getting your location...' : 'Continue to chat'}
        </button>
      </form>
    </div>
  );
}

function ChatContent({
  token,
  profile,
  onRequeue,
}: {
  token: string | null;
  profile: Profile;
  onRequeue: () => void;
}) {
  const [partner, setPartner] = useState<{ user_id: string; username: string; display_name?: string; age?: string; country?: string } | null>(null);
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
          <span className="text-sm text-zinc-500">Chatting as {profile.name}</span>
          {status === 'open' && phase === 'waiting' && (
            <span className="text-sm text-zinc-500">· Looking for someone...</span>
          )}
          {phase === 'matched' && partner && (
            <span className="text-sm text-zinc-400">
              · {partner.display_name || partner.username || 'Stranger'}
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="h-14 w-14 rounded-full border-2 border-amber-500/50 border-t-amber-500 animate-spin" />
              <div className="absolute inset-0 h-14 w-14 rounded-full border-2 border-transparent border-b-amber-400/70 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
            </div>
            <p className="text-zinc-400 text-sm">Connecting to BlinkChat...</p>
          </div>
        )}

        {phase === 'waiting' && status === 'open' && (
          <div className="flex flex-col items-center gap-8 max-w-md mx-auto text-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" />
              </div>
              <div className="absolute -inset-1 rounded-full bg-amber-500/5 animate-pulse" style={{ animationDuration: '2s' }} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-zinc-100">Looking for someone...</h2>
              <p className="text-zinc-500 text-sm leading-relaxed">
                You’ll be matched with a random stranger for a video chat. This usually takes a few seconds.
              </p>
            </div>
            <div className="flex items-center gap-2 text-zinc-600 text-xs">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500/60 animate-pulse" />
              <span>Waiting for a match</span>
            </div>
          </div>
        )}

        {phase === 'matched' && (
          <div className="flex w-full max-w-4xl flex-1 flex-col gap-4 lg:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <div className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-500/80">You</p>
                  <p className="font-medium text-zinc-100">{profile.name}</p>
                  <p className="text-sm text-zinc-400">Age {profile.age} · {profile.country ?? '—'}</p>
                </div>
                <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Partner</p>
                  <p className="font-medium text-zinc-100">{partner?.display_name || partner?.username || 'Stranger'}</p>
                  <p className="text-sm text-zinc-400">
                    {partner?.age ? `Age ${partner.age}` : 'Age —'} · {partner?.country ?? '—'}
                  </p>
                </div>
              </div>
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

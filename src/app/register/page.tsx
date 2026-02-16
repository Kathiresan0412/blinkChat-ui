'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { register as doRegister, getToken, getMe } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await doRegister(username, password, email);
      const { access } = await getToken(username, password);
      localStorage.setItem('blinkchat_token', access);
      const me = await getMe(access);
      if (me && 'user_id' in me) localStorage.setItem('blinkchat_user_id', String((me as { user_id?: number }).user_id));
      router.push('/chat');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl">
        <h1 className="mb-4 text-xl font-semibold">Create account</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-500 py-2 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account? <Link href="/login" className="text-amber-500 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

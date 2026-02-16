import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <main className="flex max-w-md flex-col items-center gap-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">BlinkChat</h1>
        <p className="text-lg text-zinc-400">
          Video chat with random people. One click to start.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/chat"
            className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
          >
            Start Chat
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-zinc-600 px-8 py-3 font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-zinc-600 px-8 py-3 font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            Register
          </Link>
        </div>
        <p className="text-sm text-zinc-500">
          By starting, you agree to be respectful. Report abuse when you see it.
        </p>
      </main>
    </div>
  );
}

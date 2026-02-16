import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <main className="flex max-w-md flex-col items-center gap-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">BlinkChat</h1>
        <p className="text-lg text-zinc-400">
          Video chat with random people. One click to start.
        </p>
        <Link
          href="/chat"
          className="rounded-full bg-amber-500 px-10 py-3.5 font-semibold text-zinc-950 transition hover:bg-amber-400"
        >
          Start Chat
        </Link>
        <p className="text-sm text-zinc-500">
          By starting, you agree to be respectful.
        </p>
      </main>
    </div>
  );
}

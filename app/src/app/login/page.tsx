import { login } from "./actions";
import Link from "next/link";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const searchParams = await props.searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 via-orange-50/30 to-stone-100 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-stone-400">
            Still Here
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-800">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Sign in to sync your data across devices
          </p>
        </div>

        {searchParams.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        {searchParams.message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {searchParams.message}
          </div>
        )}

        <form className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-stone-600">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="h-11 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-800 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-stone-600">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="h-11 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-800 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <button
            formAction={login}
            className="h-11 w-full rounded-xl bg-stone-800 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700"
          >
            Sign in
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-stone-700 hover:text-stone-900 underline underline-offset-2">
            Sign up
          </Link>
        </p>

        <div className="text-center">
          <Link href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Continue without an account
          </Link>
        </div>
      </div>
    </div>
  );
}

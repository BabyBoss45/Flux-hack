'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/auth-client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await signIn.email({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message || 'Login failed');
      }

      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel w-full max-w-[40%] min-w-[400px]">
      <div className="panel-header text-center pb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] bg-clip-text text-transparent mb-3">
          InteriorMaxi
        </h1>
        <h2 className="text-2xl font-semibold text-white mb-2">Welcome Back</h2>
        <p className="text-lg text-white/50">Sign in to your interior design studio</p>
      </div>
      <div className="panel-body pt-0">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label htmlFor="email" className="text-base font-medium text-white/70">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="password" className="text-base font-medium text-white/70">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-base text-[#ff3b5c]">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-lg font-semibold"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-8 text-center text-base text-white/40">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[#00ff9d] hover:text-[#00ffaa] hover:underline transition-colors font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="text-[#00ff9d]/50 animate-pulse">Loading...</div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}

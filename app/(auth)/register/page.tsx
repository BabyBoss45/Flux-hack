'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="panel w-full max-w-[40%] min-w-[400px]">
        <div className="panel-header text-center pb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] bg-clip-text text-transparent mb-3">
            InteriorMaxi
          </h1>
          <h2 className="text-2xl font-semibold text-white mb-2">Create Account</h2>
          <p className="text-lg text-white/50">Start designing your dream space</p>
        </div>
        <div className="panel-body pt-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="name" className="text-base font-medium text-white/70">
                Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>

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
                className="h-12 text-base"
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
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-8 text-center text-base text-white/40">
            Already have an account?{' '}
            <Link href="/login" className="text-[#00ff9d] hover:text-[#00ffaa] hover:underline transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

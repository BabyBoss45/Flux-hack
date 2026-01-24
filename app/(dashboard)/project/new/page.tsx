'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a project name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const data = await res.json();
      router.push(`/project/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <Header />

      <main className="page-main">
        <div className="max-w-lg mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-white/60 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to projects
          </Link>

          <div className="panel">
            <div className="panel-header text-center">
              <h1 className="text-2xl font-bold text-white">Create New Project</h1>
              <p className="text-white/60 mt-1">
                Start by giving your project a name
              </p>
            </div>
            <div className="panel-body">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-white/80">
                    Project Name
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="e.g., Downtown Apartment Redesign"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-accent-warm hover:bg-accent-warm/90"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

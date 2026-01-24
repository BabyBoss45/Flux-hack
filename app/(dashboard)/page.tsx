import Link from 'next/link';
import { Plus, Folder, Calendar, ArrowRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth/mock-auth';
import { getProjectsByUserId } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';

export default async function DashboardPage() {
  const session = await requireAuth();
  const projects = getProjectsByUserId(session.user.id);

  return (
    <div className="page-shell">
      <Header userName={session.user.name} />

      <main className="page-main">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">Your Projects</h2>
              <p className="text-white/60">Design and visualize your spaces</p>
            </div>
            <Link href="/project/new">
              <Button className="bg-accent-warm hover:bg-accent-warm/90">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="panel text-center py-12">
              <div className="panel-body">
                <Folder className="w-12 h-12 mx-auto mb-4 text-white/40" />
                <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                <p className="text-white/60 mb-4">
                  Create your first project to start designing
                </p>
                <Link href="/project/new">
                  <Button className="bg-accent-warm hover:bg-accent-warm/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const preferences = project.global_preferences
                  ? JSON.parse(project.global_preferences)
                  : {};

                return (
                  <Link key={project.id} href={`/project/${project.id}`}>
                    <div className="panel h-full hover:border-white/20 transition-colors cursor-pointer">
                      <div className="panel-header">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{project.name}</span>
                          <ArrowRight className="w-4 h-4 text-white/40" />
                        </div>
                        <div className="flex items-center gap-1 text-sm text-white/50 mt-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="panel-body">
                        <div className="flex flex-wrap gap-2">
                          {preferences.style && (
                            <span className="chip chip-active">
                              {preferences.style}
                            </span>
                          )}
                          {preferences.colors && (
                            <span className="chip chip-muted">
                              {preferences.colors}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

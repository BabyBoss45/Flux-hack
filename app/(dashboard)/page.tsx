import Link from 'next/link';
import { Plus, Folder, Calendar, ArrowRight } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getProjectsByUserId } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }
  const projects = getProjectsByUserId(session.user.id);

  return (
    <div className="page-shell">
      <Header userName={session.user.name} />

      <main className="page-main">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">Your Projects</h2>
              <p className="text-lg text-white/50">Design and visualize your spaces</p>
            </div>
            <Link href="/project/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="panel text-center py-16">
              <div className="panel-body">
                <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.2)] flex items-center justify-center">
                  <Folder className="w-10 h-10 text-[#00ff9d]/60" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">No projects yet</h3>
                <p className="text-base text-white/50 mb-8">
                  Create your first project to start designing
                </p>
                <Link href="/project/new">
                  <Button>
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
                    <div className="panel h-full hover:border-[rgba(0,255,157,0.3)] hover:shadow-[0_0_25px_rgba(0,255,157,0.1)] transition-all duration-300 cursor-pointer group">
                      <div className="panel-header">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold text-white group-hover:text-[#00ff9d] transition-colors">{project.name}</span>
                          <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-[#00ff9d] group-hover:translate-x-1 transition-all" />
                        </div>
                        <div className="flex items-center gap-1.5 text-base text-white/40 mt-2">
                          <Calendar className="w-4 h-4" />
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

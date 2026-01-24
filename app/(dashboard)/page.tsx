import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Folder, Calendar, ArrowRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth/mock-auth';
import { getProjectsByUserId } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const session = await requireAuth();
  const projects = getProjectsByUserId(session.user.id);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Interior Design Studio</h1>
            <p className="text-sm text-muted-foreground">Welcome, {session.user.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/api/auth/logout">
              <Button variant="ghost" size="sm">Sign Out</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Your Projects</h2>
            <p className="text-muted-foreground">Design and visualize your spaces</p>
          </div>
          <Link href="/project/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Folder className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first project to start designing
              </p>
              <Link href="/project/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const preferences = project.global_preferences
                ? JSON.parse(project.global_preferences)
                : {};

              return (
                <Link key={project.id} href={`/project/${project.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{project.name}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(project.updated_at).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {preferences.style && (
                          <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                            {preferences.style}
                          </span>
                        )}
                        {preferences.colors && (
                          <span className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground">
                            {preferences.colors}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

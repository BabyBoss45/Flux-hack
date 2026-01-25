'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { RoomShoppingCard, type RoomAnalysis } from '@/components/finalize/room-shopping-card';
import { ShoppingSummary, exportShoppingList } from '@/components/finalize/shopping-summary';
import { ShareDialog } from '@/components/project/share-dialog';

interface Project {
  id: number;
  name: string;
  floor_plan_url: string | null;
  global_preferences: string;
}

interface Room {
  id: number;
  name: string;
  type: string;
  approved: number;
}

interface RoomImage {
  id: number;
  url: string;
  prompt: string;
  view_type: string;
  created_at: string;
}

interface RoomWithAnalysis {
  room: Room;
  latestImage: RoomImage | null;
  analysis: RoomAnalysis;
}

export default function FinalizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [roomsWithAnalysis, setRoomsWithAnalysis] = useState<RoomWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);

  // Fetch project and rooms data
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch project
        const projectRes = await fetch(`/api/projects/${projectId}`);
        if (!projectRes.ok) {
          router.push('/');
          return;
        }
        const projectData = await projectRes.json();
        setProject(projectData.project);

        const rooms: Room[] = projectData.rooms || [];
        
        // Fetch images for each room
        const roomsData: RoomWithAnalysis[] = await Promise.all(
          rooms.map(async (room) => {
            try {
              const imagesRes = await fetch(`/api/rooms/${room.id}/images`);
              const imagesData = imagesRes.ok ? await imagesRes.json() : { images: [] };
              const images: RoomImage[] = imagesData.images || [];
              
              // Get the latest (first) image
              const latestImage = images.length > 0 ? images[0] : null;

              return {
                room,
                latestImage,
                analysis: { status: 'idle' as const },
              };
            } catch {
              return {
                room,
                latestImage: null,
                analysis: { status: 'idle' as const },
              };
            }
          })
        );

        setRoomsWithAnalysis(roomsData);
      } catch (error) {
        console.error('Failed to fetch project:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId, router]);

  // Analyze a single room
  const analyzeRoom = async (roomIndex: number) => {
    const roomData = roomsWithAnalysis[roomIndex];
    if (!roomData.latestImage) return;

    // Set loading state
    setRoomsWithAnalysis((prev) => {
      const updated = [...prev];
      updated[roomIndex] = {
        ...updated[roomIndex],
        analysis: { status: 'loading' },
      };
      return updated;
    });

    try {
      // Create form data with image URL
      const formData = new FormData();
      formData.append('imageUrl', roomData.latestImage.url);

      const response = await fetch('/api/llm/analyze-and-shop', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();

      setRoomsWithAnalysis((prev) => {
        const updated = [...prev];
        updated[roomIndex] = {
          ...updated[roomIndex],
          analysis: {
            status: result.status === 'success' ? 'success' : 'error',
            object_names: result.object_names,
            total_price: result.total_price,
            objects: result.objects,
            overall_style: result.overall_style,
            color_palette: result.color_palette,
            error: result.error,
          },
        };
        return updated;
      });
    } catch (error) {
      setRoomsWithAnalysis((prev) => {
        const updated = [...prev];
        updated[roomIndex] = {
          ...updated[roomIndex],
          analysis: {
            status: 'error',
            error: error instanceof Error ? error.message : 'Analysis failed',
          },
        };
        return updated;
      });
    }
  };

  // Analyze all rooms
  const analyzeAllRooms = async () => {
    setAnalyzingAll(true);
    
    // Analyze rooms sequentially to avoid overwhelming the API
    for (let i = 0; i < roomsWithAnalysis.length; i++) {
      const roomData = roomsWithAnalysis[i];
      if (roomData.latestImage && roomData.analysis.status !== 'success') {
        await analyzeRoom(i);
      }
    }
    
    setAnalyzingAll(false);
  };

  // Export shopping list
  const handleExport = () => {
    const data = roomsWithAnalysis.map((r) => ({
      roomId: r.room.id,
      roomName: r.room.name,
      analysis: r.analysis,
    }));

    const text = exportShoppingList(data);
    
    // Download as text file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'project'}-shopping-list.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Check if all rooms are approved
  const allRoomsApproved = roomsWithAnalysis.length > 0 && 
    roomsWithAnalysis.every((r) => r.room.approved === 1);

  // Count rooms with images
  const roomsWithImages = roomsWithAnalysis.filter((r) => r.latestImage).length;
  const analyzedRooms = roomsWithAnalysis.filter((r) => r.analysis.status === 'success').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-accent-warm border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="page-shell">
      <Header showSteps currentStep={3} />

      <main className="page-main">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Link
                href={`/project/${projectId}`}
                className="inline-flex items-center text-sm text-white/60 hover:text-white mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to design
              </Link>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="text-white/60">
                Finalize your design and shop for furniture
              </p>
            </div>

            <div className="flex items-center gap-3">
              {roomsWithImages > 0 && analyzedRooms < roomsWithImages && (
                <Button
                  onClick={analyzeAllRooms}
                  disabled={analyzingAll}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  {analyzingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Analyze All Rooms
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Room cards - 3 columns */}
            <div className="lg:col-span-3">
              {roomsWithAnalysis.length === 0 ? (
                <div className="panel p-8 text-center">
                  <p className="text-white/60">No rooms found in this project.</p>
                  <Link
                    href={`/project/${projectId}`}
                    className="text-accent-warm hover:underline mt-2 inline-block"
                  >
                    Go back and add rooms
                  </Link>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {roomsWithAnalysis.map((roomData, index) => (
                    <RoomShoppingCard
                      key={roomData.room.id}
                      roomId={roomData.room.id}
                      roomName={roomData.room.name}
                      imageUrl={roomData.latestImage?.url || ''}
                      analysis={roomData.analysis}
                      onAnalyze={() => analyzeRoom(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Summary sidebar - 1 column */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <ShoppingSummary
                  rooms={roomsWithAnalysis.map((r) => ({
                    roomId: r.room.id,
                    roomName: r.room.name,
                    analysis: r.analysis,
                  }))}
                  onShare={() => setShareOpen(true)}
                  onExport={handleExport}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={projectId}
        allRoomsApproved={allRoomsApproved}
      />
    </div>
  );
}

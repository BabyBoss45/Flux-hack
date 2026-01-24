'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Share2, Upload, Edit3, Check, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { RoomGrid } from '@/components/rooms/room-grid';
import { RoomImageViewer } from '@/components/rooms/room-image-viewer';
import { ChatPanel } from '@/components/chat/chat-panel';
import { ItemEditDialog } from '@/components/chat/item-edit-dialog';
import { FloorplanUploader } from '@/components/floorplan/floorplan-uploader';
import { ManualRoomEntry } from '@/components/floorplan/manual-room-entry';
import { PreferencesDialog } from '@/components/project/preferences-dialog';
import { ShareDialog } from '@/components/project/share-dialog';
import { useChat } from '@/hooks/use-chat';
import { ImageGeneration } from '@/components/ui/ai-chat-image-generation-1';

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
  detected_items: string;
  created_at: string;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomImages, setRoomImages] = useState<RoomImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState<'upload' | 'manual' | null>(null);

  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { messages, isLoading: chatLoading, sendMessage } = useChat({
    projectId,
    roomId: selectedRoomId,
  });

  // Calculate current step
  const allRoomsApproved = rooms.length > 0 && rooms.every((r) => r.approved);
  const getCurrentStep = (): 1 | 2 | 3 => {
    if (rooms.length === 0) return 1;
    if (!allRoomsApproved) return 2;
    return 3;
  };
  const currentStep = getCurrentStep();

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        setProject(data.project);
        setRooms(data.rooms || []);

        if (data.rooms?.length > 0 && !selectedRoomId) {
          setSelectedRoomId(data.rooms[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch project:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId, router]);

  // Fetch room images when room changes
  useEffect(() => {
    if (!selectedRoomId) return;

    async function fetchRoomImages() {
      try {
        const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (res.ok) {
          const data = await res.json();
          setRoomImages(data.images || []);
          setCurrentImageIndex(0);
        }
      } catch (error) {
        console.error('Failed to fetch room images:', error);
      }
    }

    fetchRoomImages();
  }, [selectedRoomId]);

  const handleRoomSelect = (roomId: number) => {
    setSelectedRoomId(roomId);
  };

  const handleUploadComplete = (url: string) => {
    if (project) {
      setProject({ ...project, floor_plan_url: url });
    }
  };

  const handleRoomsDetected = () => {
    window.location.reload();
  };

  const handlePreferencesSave = async (preferences: { style?: string; colors?: string; budget?: string; notes?: string }) => {
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_preferences: JSON.stringify(preferences) }),
    });

    if (project) {
      setProject({ ...project, global_preferences: JSON.stringify(preferences) });
    }
  };

  const handleEditImage = (imageId: number) => {
    setEditingImageId(imageId);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (_imageId: number, prompt: string) => {
    sendMessage(`Please edit the image: ${prompt}`);
  };

  const handleTestGenerateImage = async () => {
    if (!selectedRoomId) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/rooms/${selectedRoomId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_room_image',
          roomId: selectedRoomId,
          description:
            'A cozy modern living room with a large sectional sofa, warm wood flooring, and soft ambient lighting.',
          viewType: 'perspective',
          dimensions: { width: 1024, height: 768 },
          style: 'modern',
          colorPalette:
            'warm neutrals with soft beige and tan, black metal accents',
          camera: { angle: 'eye-level', lens: 'wide' },
          runware: { steps: 30, cfgScale: 7.5, model: 'runware:101@1', numberResults: 1 },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with ${res.status}`);
      }

      // Refresh room images after generation
      if (selectedRoomId) {
        const imagesRes = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (imagesRes.ok) {
          const data = await imagesRes.json();
          setRoomImages(data.images || []);
          setCurrentImageIndex(0);
        }
      }
    } catch (err) {
      console.error('Test generate image failed:', err);
      setGenerateError(
        err instanceof Error ? err.message : 'Failed to generate image'
      );
    } finally {
      setGenerating(false);
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const preferences = project?.global_preferences
    ? JSON.parse(project.global_preferences)
    : {};

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

  // Step 1: Upload / Setup
  if (currentStep === 1) {
    return (
      <div className="page-shell">
        <Header showSteps currentStep={1} />

        <main className="page-main">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-white/60 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to projects
            </Link>

            <h1 className="text-2xl font-bold text-white mb-6">{project.name}</h1>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left: Upload panel */}
              <div className="panel">
                <div className="panel-header">
                  <h2 className="text-lg font-semibold text-white">Add Your Space</h2>
                </div>
                <div className="panel-body">
                  {!setupMode ? (
                    <div className="grid gap-4">
                      <button
                        onClick={() => setSetupMode('upload')}
                        className="p-6 border border-white/20 rounded-lg hover:border-accent-warm hover:bg-accent-warm/10 transition-colors text-left"
                      >
                        <Upload className="w-8 h-8 mb-4 text-accent-warm" />
                        <h3 className="font-semibold mb-2 text-white">Upload Floor Plan</h3>
                        <p className="text-sm text-white/60">
                          Upload a PDF or image of your floor plan and we&apos;ll detect the rooms
                        </p>
                      </button>

                      <button
                        onClick={() => setSetupMode('manual')}
                        className="p-6 border border-white/20 rounded-lg hover:border-accent-warm hover:bg-accent-warm/10 transition-colors text-left"
                      >
                        <Edit3 className="w-8 h-8 mb-4 text-accent-warm" />
                        <h3 className="font-semibold mb-2 text-white">Enter Manually</h3>
                        <p className="text-sm text-white/60">
                          Manually enter the rooms in your space
                        </p>
                      </button>
                    </div>
                  ) : setupMode === 'upload' ? (
                    <div>
                      <Button
                        variant="ghost"
                        onClick={() => setSetupMode(null)}
                        className="mb-4 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <FloorplanUploader
                        projectId={projectId}
                        onUploadComplete={handleUploadComplete}
                        onRoomsDetected={handleRoomsDetected}
                      />
                    </div>
                  ) : (
                    <div>
                      <Button
                        variant="ghost"
                        onClick={() => setSetupMode(null)}
                        className="mb-4 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <ManualRoomEntry
                        projectId={projectId}
                        onComplete={handleRoomsDetected}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Chat panel for initial goals */}
              <ChatPanel
                messages={messages}
                isLoading={chatLoading}
                onSend={sendMessage}
                placeholder="Describe your design goals..."
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Step 2: Design
  if (currentStep === 2) {
    return (
      <div className="page-shell">
        <Header showSteps currentStep={2} />

        <main className="flex-1 flex overflow-hidden">
          {/* Constrained container with max-width and padding */}
          <div className="w-full max-w-[1680px] mx-auto px-6 lg:px-8 pt-6 pb-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Left column: Room selection + Chat (20% width, stacked) */}
            <div className="w-full lg:w-[20%] flex flex-col min-w-0 gap-6 lg:gap-8">
              {/* Room selector card - narrower */}
              <div className="panel">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-white text-sm">{project.name}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreferencesOpen(true)}
                      className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {/* Temporary test button to trigger image generation without chat */}
                  {selectedRoomId && (
                    <div className="mb-3 space-y-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestGenerateImage}
                        disabled={generating}
                        className="w-full border-accent-warm/60 text-accent-warm hover:bg-accent-warm/10 text-xs h-7"
                      >
                        {generating ? 'Generating…' : 'Test generate'}
                      </Button>
                      {generateError && (
                        <p className="text-xs text-red-400">{generateError}</p>
                      )}
                    </div>
                  )}
                  <RoomGrid
                    rooms={rooms.map((r) => ({ ...r, approved: r.approved === 1 }))}
                    selectedRoomId={selectedRoomId}
                    onSelectRoom={handleRoomSelect}
                  />
                </div>
              </div>

              {/* Chat panel card - stacked below room selection */}
              <div className="flex flex-col min-h-0 flex-1">
                <ChatPanel
                  messages={messages}
                  isLoading={chatLoading}
                  onSend={sendMessage}
                  onEditImage={handleEditImage}
                  placeholder={`Describe your vision for the ${selectedRoom?.name || 'room'}...`}
                />
              </div>
            </div>

            {/* Right column: Room generation/image viewer (80% width) */}
            <div className="w-full lg:w-[80%] flex flex-col min-w-0">
              <div className="panel flex-1">
                <div className="p-5">
                  {generating ? (
                    <ImageGeneration className="w-full">
                      <div className="flex items-center justify-center bg-white/5 min-h-[400px] max-h-[600px] rounded-lg">
                        <div className="text-center text-white/60 text-sm">
                          Generating a new design for this room...
                        </div>
                      </div>
                    </ImageGeneration>
                  ) : (
                    <div className="w-full flex items-center justify-center">
                      <RoomImageViewer
                        images={roomImages}
                        currentIndex={currentImageIndex}
                        onIndexChange={setCurrentImageIndex}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Dialogs */}
        <PreferencesDialog
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
          projectId={projectId}
          initialPreferences={preferences}
          onSave={handlePreferencesSave}
        />

        {editingImageId && (
          <ItemEditDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            imageId={editingImageId}
            imageUrl={roomImages.find((img) => img.id === editingImageId)?.url || ''}
            onSubmit={handleEditSubmit}
          />
        )}
      </div>
    );
  }

  // Step 3: Finalize
  return (
    <div className="page-shell">
      <Header showSteps currentStep={3} />

      <main className="page-main">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="text-white/60">Your design is complete!</p>
            </div>
            <Button
              onClick={() => setShareOpen(true)}
              className="bg-accent-warm hover:bg-accent-warm/90"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Design
            </Button>
          </div>

          {/* Room gallery */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              return (
                <RoomCard
                  key={room.id}
                  room={room}
                  projectId={projectId}
                  onSelect={() => {
                    setSelectedRoomId(room.id);
                    // Could show a preview modal here
                  }}
                />
              );
            })}
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

// Room card component for Step 3
function RoomCard({
  room,
  onSelect,
}: {
  room: Room;
  projectId: number;
  onSelect: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchThumbnail() {
      try {
        const res = await fetch(`/api/rooms/${room.id}/images`);
        if (res.ok) {
          const data = await res.json();
          if (data.images?.length > 0) {
            setThumbnail(data.images[data.images.length - 1].url);
          }
        }
      } catch (error) {
        console.error('Failed to fetch thumbnail:', error);
      }
    }
    fetchThumbnail();
  }, [room.id]);

  return (
    <button
      onClick={onSelect}
      className="panel text-left overflow-hidden hover:border-white/20 transition-colors"
    >
      {thumbnail ? (
        <div className="aspect-video relative">
          <img
            src={thumbnail}
            alt={room.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-white/5 flex items-center justify-center">
          <Image className="w-8 h-8 text-white/20" />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-white">{room.name}</h3>
        <p className="text-sm text-white/50">{room.type}</p>
      </div>
    </button>
  );
}

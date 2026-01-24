'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Share2, Upload, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoomSidebar } from '@/components/rooms/room-sidebar';
import { RoomImageViewer } from '@/components/rooms/room-image-viewer';
import { ChatInterface } from '@/components/chat/chat-interface';
import { ChatInput } from '@/components/chat/chat-input';
import { ItemEditDialog } from '@/components/chat/item-edit-dialog';
import { FloorplanUploader } from '@/components/floorplan/floorplan-uploader';
import { ManualRoomEntry } from '@/components/floorplan/manual-room-entry';
import { PreferencesDialog } from '@/components/project/preferences-dialog';
import { ShareDialog } from '@/components/project/share-dialog';
import { useChat } from '@/hooks/use-chat';

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

  const { messages, isLoading: chatLoading, isLoadingHistory, sendMessage } = useChat({
    projectId,
    roomId: selectedRoomId,
  });

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
    // Refresh project data
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

  const handleEditSubmit = async (imageId: number, prompt: string) => {
    // Send edit request through chat
    sendMessage(`Please edit the image: ${prompt}`);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const allRoomsApproved = rooms.length > 0 && rooms.every((r) => r.approved);
  const preferences = project?.global_preferences
    ? JSON.parse(project.global_preferences)
    : {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  // Show setup if no rooms
  if (rooms.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to projects
            </Link>
            <h1 className="text-xl font-bold mt-2">{project.name}</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Let&apos;s Get Started</h2>
            <p className="text-muted-foreground">
              First, we need to know about your space
            </p>
          </div>

          {!setupMode ? (
            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => setSetupMode('upload')}
                className="p-6 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <Upload className="w-8 h-8 mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Upload Floor Plan</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a PDF or image of your floor plan and we&apos;ll detect the rooms
                </p>
              </button>

              <button
                onClick={() => setSetupMode('manual')}
                className="p-6 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <Edit3 className="w-8 h-8 mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Enter Manually</h3>
                <p className="text-sm text-muted-foreground">
                  Manually enter the rooms in your space
                </p>
              </button>
            </div>
          ) : setupMode === 'upload' ? (
            <div>
              <Button
                variant="ghost"
                onClick={() => setSetupMode(null)}
                className="mb-4"
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
                className="mb-4"
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
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-semibold">{project.name}</h1>
              {selectedRoom && (
                <p className="text-xs text-muted-foreground">
                  Designing: {selectedRoom.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreferencesOpen(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Preferences
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareOpen(true)}
              disabled={!allRoomsApproved}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Room sidebar */}
        <RoomSidebar
          rooms={rooms.map((r) => ({ ...r, approved: r.approved === 1 }))}
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleRoomSelect}
        />

        {/* Main area with tabs */}
        <div className="flex-1 flex flex-col">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-2 w-fit">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
              {isLoadingHistory ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading conversation history...</p>
                  </div>
                </div>
              ) : (
                <>
                  <ChatInterface
                    messages={messages}
                    isLoading={chatLoading}
                    onEditImage={handleEditImage}
                  />
                  <ChatInput
                    onSend={sendMessage}
                    isLoading={chatLoading}
                    placeholder={`Describe your vision for the ${selectedRoom?.name || 'room'}...`}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="gallery" className="flex-1 flex flex-col mt-0">
              <RoomImageViewer
                images={roomImages}
                currentIndex={currentImageIndex}
                onIndexChange={setCurrentImageIndex}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <PreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        projectId={projectId}
        initialPreferences={preferences}
        onSave={handlePreferencesSave}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={projectId}
        allRoomsApproved={allRoomsApproved}
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

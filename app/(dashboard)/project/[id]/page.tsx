'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Share2, Upload, Edit3, Check, Image, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { RoomGrid } from '@/components/rooms/room-grid';
import { RoomImageViewer } from '@/components/rooms/room-image-viewer';
import { ChatWrapper } from '@/components/chat/chat-wrapper';
import { ItemEditDialog } from '@/components/chat/item-edit-dialog';
import { FloorplanUploader } from '@/components/floorplan/floorplan-uploader';
import { ManualRoomEntry } from '@/components/floorplan/manual-room-entry';
import { PreferencesDialog } from '@/components/project/preferences-dialog';
import { ShareDialog } from '@/components/project/share-dialog';
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

// Client-side room keys (stable, human-readable, UNIQUE per room instance)
type RoomKey = string; // e.g., "living-room-1", "living-room-2", "kitchen-1"

// Normalize room type from name/type
function normalizeRoomType(room: Room): string {
  const nameLower = room.name.toLowerCase();
  const typeLower = room.type?.toLowerCase() || '';
  
  if (nameLower.includes('living') || typeLower.includes('living')) return 'living-room';
  if (nameLower.includes('kitchen') || typeLower.includes('kitchen')) return 'kitchen';
  if (nameLower.includes('bedroom') || typeLower.includes('bedroom')) return 'bedroom';
  if (nameLower.includes('bathroom') || typeLower.includes('bath')) return 'bathroom';
  if (nameLower.includes('dining') || typeLower.includes('dining')) return 'dining';
  if (nameLower.includes('office') || typeLower.includes('office')) return 'office';
  return 'other';
}

// CRITICAL: Generate UNIQUE room keys for each room instance
// This ensures multiple rooms of the same type get different keys
function buildRoomKeys(rooms: Room[]): Array<Room & { roomKey: RoomKey }> {
  const counters: Record<string, number> = {};

  return rooms.map(room => {
    const type = normalizeRoomType(room);
    counters[type] = (counters[type] || 0) + 1;
    const roomKey = `${type}-${counters[type]}` as RoomKey; // e.g., "living-room-1", "living-room-2"

    return {
      ...room,
      roomKey, // Store unique key directly on room object
    };
  });
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
  const [selectedRoomKey, setSelectedRoomKey] = useState<RoomKey | null>(null);
  const [roomImages, setRoomImages] = useState<RoomImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImageId, setCurrentImageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState<'upload' | 'manual' | null>(null);

  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<{ id: string; label: string } | null>(null);

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
        const fetchedRooms = data.rooms || [];
        
        // CRITICAL: Generate UNIQUE room keys for each room instance
        // This ensures multiple rooms of the same type get different keys
        const roomsWithKeys = buildRoomKeys(fetchedRooms);
        setRooms(roomsWithKeys);

        // CRITICAL: Always set first room key if rooms exist
        if (roomsWithKeys.length > 0) {
          const firstRoom = roomsWithKeys[0];
          const firstRoomKey = firstRoom.roomKey!; // Key is guaranteed after buildRoomKeys
          console.log('🔥🔥🔥 AUTO-SELECTING FIRST ROOM 🔥🔥🔥', {
            roomKey: firstRoomKey,
            roomName: firstRoom.name,
            roomId: firstRoom.id,
            totalRooms: roomsWithKeys.length,
            timestamp: new Date().toISOString(),
          });
          setSelectedRoomKey(firstRoomKey);
        } else {
          console.warn('⚠️⚠️⚠️ NO ROOMS FOUND ⚠️⚠️⚠️');
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

  // CRITICAL: Find room by stored roomKey (not recomputed)
  // This ensures we get the correct room instance, not just the first match
  const selectedRoom = rooms.find(r => r.roomKey === selectedRoomKey);
  const selectedRoomId = selectedRoom?.id || null;

  // Fetch room images when room changes (still use DB roomId for image fetching)
  useEffect(() => {
    if (!selectedRoomId) return;

    async function fetchRoomImages() {
      try {
        const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (res.ok) {
          const data = await res.json();
          
          setRoomImages(data.images || []);
          if (data.images?.length > 0) {
            setCurrentImageIndex(0);
            const firstImageId = data.images[0].id;
            console.log('[PROJECT PAGE] Room images loaded - Setting currentImageId:', firstImageId);
            setCurrentImageId(firstImageId);
          } else {
            console.log('[PROJECT PAGE] No images in room - Setting currentImageId: null');
            setCurrentImageId(null);
          }
          
          // Check if any images need object detection and trigger it immediately
          const imagesNeedingDetection = data.images?.filter((img: any) => {
            const items = img.detected_items;
            return !items || items === 'null' || items.trim() === '' || items === '[]';
          }) || [];
          
          // Trigger detection for all images that need it
          if (imagesNeedingDetection.length > 0) {
            // Run detection in background, then refresh images
            fetch(`/api/rooms/${selectedRoomId}/detect-objects`, {
              method: 'POST',
            })
              .then(() => {
                // Refresh images after detection completes
                return fetch(`/api/rooms/${selectedRoomId}/images`);
              })
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data?.images) {
                  setRoomImages(data.images);
                }
              })
              .catch(err => {
                console.error('Failed to trigger object detection:', err);
              });
          }
        }
      } catch (error) {
        console.error('Failed to fetch room images:', error);
      }
    }

    fetchRoomImages();
  }, [selectedRoomKey, selectedRoomId]); // Depend on both key and computed ID

  // CRITICAL: Handle image generation - IMMEDIATE currentImageId update
  // The visible image MUST be the single source of truth
  const handleImageGenerated = async (imageUrl: string, detectedObjects: any[]) => {
    // Handle detectedObjects correctly - null means not detected, [] means empty
    const detectedItemsJson = Array.isArray(detectedObjects) && detectedObjects.length > 0
      ? JSON.stringify(detectedObjects)
      : '[]';
    
    // IMMEDIATELY create and display the image (don't wait for API)
    const tempImageId = Date.now(); // Temporary ID (will be replaced when API syncs)
    const tempImage: RoomImage = {
      id: tempImageId,
      url: imageUrl,
      prompt: 'Generated image',
      view_type: 'perspective',
      detected_items: detectedItemsJson,
      created_at: new Date().toISOString(),
    };
    
    // CRITICAL: Stop generation animation FIRST, then update images
    setIsGenerating(false);
    
    // CRITICAL: Set currentImageId IMMEDIATELY - before any async operations
    // This ensures chat can send messages with the correct image ID
    console.log('[PROJECT PAGE] Image generated - Setting currentImageId IMMEDIATELY:', tempImageId);
    setCurrentImageId(tempImageId);
    setCurrentImageIndex(0);
    setRoomImages([tempImage, ...roomImages]);
    
    // Preload the image
    setIsImageLoading(true);
    const img = new window.Image();
    img.src = imageUrl;
    img.onload = () => {
      setIsImageLoading(false);
    };
    img.onerror = () => {
      setIsImageLoading(false);
    };
    
    // Sync with API in background (non-blocking) to get proper IDs
    // CRITICAL: Update currentImageId when real ID comes back
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (res.ok) {
          const data = await res.json();
          const newImages = data.images || [];
          // Update with real data from API (includes proper IDs, etc.)
          if (newImages.length > 0) {
            const realImageId = newImages[0].id;
            console.log('[PROJECT PAGE] Images synced from API - Updating currentImageId from', tempImageId, 'to', realImageId);
            setRoomImages(newImages);
            setCurrentImageIndex(0);
            // CRITICAL: Update currentImageId to real ID - this ensures future edits use correct ID
            setCurrentImageId(realImageId);
          }
        }
      } catch (error) {
        // Silent fail - we already have the image displayed with temp ID
        console.error('[PROJECT PAGE] Failed to sync image ID from API:', error);
      }
    }, 1000);
  };

  // Poll for new images when chat is active (to catch images generated by chat)
  useEffect(() => {
    if (!selectedRoomId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (res.ok) {
          const data = await res.json();
          const newImageCount = data.images?.length || 0;
          const currentImageCount = roomImages.length;
          
          // Only update if we have new images
          if (newImageCount > currentImageCount) {
            const newImages = data.images || [];
            
            setIsImageLoading(true);
            setRoomImages(newImages);
            setCurrentImageIndex(0);
            setCurrentImageId(newImages[0]?.id || null);
            
            // Preload the image to ensure it's ready before hiding animation
            if (newImages[0]?.url) {
              const img = new Image();
              img.onload = () => {
                setIsImageLoading(false);
              };
              img.onerror = () => {
                setIsImageLoading(false);
              };
              img.src = newImages[0].url;
            } else {
              setIsImageLoading(false);
            }
          }
          
          // Check if any images need object detection and trigger it
          // '[]' means detection hasn't run yet (normalized from null), so we need to detect
          const imagesNeedingDetection = data.images?.filter((img: any) => {
            const items = img.detected_items;
            return !items || items === 'null' || items.trim() === '' || items === '[]';
          }) || [];
          
          // Trigger detection for images that need it, then refresh
          if (imagesNeedingDetection.length > 0) {
            fetch(`/api/rooms/${selectedRoomId}/detect-objects`, {
              method: 'POST',
            })
              .then(() => {
                // Refresh images after detection completes to show new detected_items
                return fetch(`/api/rooms/${selectedRoomId}/images`);
              })
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data?.images) {
                  setRoomImages(data.images);
                }
              })
              .catch(err => {
                console.error('Failed to trigger object detection:', err);
              });
          }
        }
      } catch (error) {
        // Silently fail polling
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [selectedRoomKey, selectedRoomId, roomImages.length]); // Depend on both key and computed ID

  const handleRoomSelect = (roomKey: RoomKey) => {
    // CRITICAL: Find room by stored roomKey (not recomputed)
    const room = rooms.find(r => r.roomKey === roomKey);
    console.log('🔥🔥🔥 ROOM SELECTED 🔥🔥🔥', {
      roomKey,
      roomName: room?.name,
      roomId: room?.id,
      timestamp: new Date().toISOString(),
    });
    console.trace('Room selection stack trace');
    setSelectedRoomKey(roomKey);
    // Clear selected object when switching rooms
    setSelectedObject(null);
    // Reset image selection when switching rooms
    // CRITICAL: Don't set currentImageId to null here - wait for images to load
    // Setting it to null breaks chat because it can fire before images load
    setCurrentImageIndex(0);
    // currentImageId will be set when images are fetched in useEffect
  };

  // Debug: Log when selectedRoomKey changes
  useEffect(() => {
    // CRITICAL: Find room by stored roomKey (not recomputed)
    const room = rooms.find(r => r.roomKey === selectedRoomKey);
    console.log('🔥🔥🔥 SELECTED ROOM KEY CHANGED 🔥🔥🔥', {
      selectedRoomKey,
      roomName: room?.name,
      roomType: room?.type,
      roomId: room?.id,
      totalRooms: rooms.length,
      timestamp: new Date().toISOString(),
    });
    if (!selectedRoomKey) {
      console.warn('⚠️⚠️⚠️ SELECTED ROOM KEY IS NULL ⚠️⚠️⚠️');
    }
  }, [selectedRoomKey, rooms]);

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

  const handleObjectSelect = (object: { id: string; label: string; category: string; bbox: [number, number, number, number] }) => {
    console.log('[PROJECT PAGE] Object selected - Replacing previous selection:', {
      previousObject: selectedObject,
      newObject: { id: object.id, label: object.label },
    });
    // CRITICAL: This replaces the previous selection - only ONE object can be selected at a time
    setSelectedObject({ id: object.id, label: object.label });
    
    // Auto-focus chat input and prepend object context
    // The chat placeholder will show "Editing [object]..." which guides the user
  };

  // selectedRoom already computed above from selectedRoomKey
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
              {/* CRITICAL: Only render chat if a room is selected - roomKey is required */}
              {/* CRITICAL: Use key to force remount when room changes */}
              {selectedRoomKey && (
                <ChatWrapper
                  key={`chat-${selectedRoomKey}`}
                  projectId={projectId}
                  roomKey={selectedRoomKey}
                  selectedObjectId={selectedObject?.id || null}
                  selectedObjectLabel={selectedObject?.label || null}
                  currentImageId={currentImageId}
                  onImageGenerated={handleImageGenerated}
                  placeholder="Describe your design goals..."
                />
              )}
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
                  {rooms.length > 0 ? (
                    <RoomGrid
                      rooms={rooms.map((r) => ({ 
                        key: r.roomKey!, // Use stored unique key
                        name: r.name,
                        approved: r.approved === 1 
                      }))}
                      selectedRoomKey={selectedRoomKey}
                      onSelectRoom={handleRoomSelect}
                    />
                  ) : (
                    <div className="text-white/50 text-sm p-4">No rooms yet</div>
                  )}
                </div>
              </div>

              {/* Chat panel card - stacked below room selection */}
              <div className="flex flex-col min-h-0 flex-1">
                {/* VISUAL INDICATOR: Show selected room name */}
                {selectedRoomKey && selectedRoom && (
                  <div className="mb-2 px-3 py-2 bg-accent-warm/20 border border-accent-warm/30 rounded text-xs text-white">
                    <span className="font-semibold">Active Room:</span> {selectedRoom.name} (Key: {selectedRoomKey})
                  </div>
                )}
                {/* CRITICAL: Only render chat if a room is selected - roomKey is required */}
                {/* CRITICAL: Use key to force remount when room changes */}
                {selectedRoomKey ? (
                  <>
                    {console.log('🔥🔥🔥 RENDERING CHAT WRAPPER 🔥🔥🔥', {
                      selectedRoomKey,
                      roomName: selectedRoom?.name,
                      currentImageId,
                      timestamp: new Date().toISOString(),
                    })}
                    <ChatWrapper
                      key={`chat-${selectedRoomKey}`}
                      projectId={projectId}
                      roomKey={selectedRoomKey}
                      selectedObjectId={selectedObject?.id || null}
                      selectedObjectLabel={selectedObject?.label || null}
                      currentImageId={currentImageId}
                      onEditImage={handleEditImage}
                      onLoadingChange={setIsGenerating}
                      onImageGenerated={handleImageGenerated}
                      placeholder={
                        selectedObject
                          ? `Editing ${selectedObject.label}...`
                          : `Describe your vision for the ${selectedRoom?.name || 'room'}...`
                      }
                    />
                  </>
                ) : (
                  <div className="panel flex items-center justify-center h-full">
                    <div className="text-white/50 text-sm text-center p-4">
                      {rooms.length === 0 ? 'No rooms available' : 'Please select a room'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Room generation/image viewer (80% width) */}
            <div className="w-full lg:w-[80%] flex flex-col min-w-0">
              <div className="panel flex-1">
                <div className="p-5">
                  {/* CORRECT RULE: As soon as we have an imageUrl, show it. Animation only if generating AND no images yet. */}
                  {roomImages.length > 0 ? (
                    <div className="w-full flex items-center justify-center">
                      {isImageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="text-center text-white/60 text-sm">Loading image...</div>
                        </div>
                      )}
                      <RoomImageViewer
                        images={roomImages}
                        currentIndex={currentImageIndex}
                        onIndexChange={(index) => {
                          // CRITICAL: Set currentImageId IMMEDIATELY when thumbnail is clicked
                          // The visible image is the single source of truth
                          if (roomImages[index]) {
                            const newImageId = roomImages[index].id;
                            console.log('[PROJECT PAGE] Thumbnail clicked - Setting currentImageId IMMEDIATELY:', newImageId, 'Index:', index);
                            setCurrentImageId(newImageId);
                            setCurrentImageIndex(index);
                          }
                        }}
                        onObjectSelect={handleObjectSelect}
                        selectedObjectId={selectedObject?.id || null}
                        onImageLoad={() => setIsImageLoading(false)}
                      />
                    </div>
                  ) : isGenerating ? (
                    <ImageGeneration className="w-full">
                      <div className="flex items-center justify-center bg-white/5 rounded-lg" style={{ aspectRatio: '1/1', maxWidth: '1024px', maxHeight: '1024px', width: '100%' }}>
                        <div className="text-center text-white/60 text-sm">
                          Generating a new design for this room...
                        </div>
                      </div>
                    </ImageGeneration>
                  ) : (
                    <div className="flex items-center justify-center bg-white/5 rounded-lg" style={{ aspectRatio: '1/1', maxWidth: '1024px', maxHeight: '1024px', width: '100%' }}>
                      <div className="text-center text-white/60 text-sm">
                        Describe how you want this room to look.
                      </div>
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
            onSubmit={async (imageId, prompt) => {
              // Send edit request through chat
              console.log('Edit image:', imageId, prompt);
            }}
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
            <div className="flex items-center gap-3">
              <Link href={`/project/${projectId}/finalize`}>
                <Button className="bg-green-600 hover:bg-green-700">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Shop Furniture
                </Button>
              </Link>
              <Button
                onClick={() => setShareOpen(true)}
                className="bg-accent-warm hover:bg-accent-warm/90"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Design
              </Button>
            </div>
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

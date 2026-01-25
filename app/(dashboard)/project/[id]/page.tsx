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
import { ServiceStatusBanner } from '@/components/floorplan/service-status-banner';
import { FloorPlanToggle } from '@/components/floorplan/floor-plan-toggle';
import { PreferencesDialog } from '@/components/project/preferences-dialog';
import { ShareDialog } from '@/components/project/share-dialog';
import { ImageGeneration } from '@/components/ui/ai-chat-image-generation-1';
import { DesignBriefWizard } from '@/components/wizard/design-brief-wizard';
import type { WizardSummaryData, WizardState } from '@/lib/wizard/types';
import {
  BUILDING_TYPE_OPTIONS,
  ARCHITECTURE_STYLE_OPTIONS,
  ATMOSPHERE_OPTIONS,
  CONSTRAINT_OPTIONS,
  getOptionLabel,
} from '@/lib/wizard/types';

interface Project {
  id: number;
  name: string;
  floor_plan_url: string | null;
  annotated_floor_plan_url: string | null;
  global_preferences: string;
  building_type: string | null;
  architecture_style: string | null;
  atmosphere: string | null;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<{ id: string; label: string } | null>(null);
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [wizardData, setWizardData] = useState<WizardSummaryData | null>(null);
  const [wizardProgress, setWizardProgress] = useState<WizardState | null>(null);

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
        if (res.status === 401) {
          // Session expired or invalid - clear cookie and redirect to login
          window.location.href = '/api/auth/logout?redirect=/login';
          return;
        }
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

        // Check if wizard is already completed
        if (data.project?.global_preferences) {
          try {
            const prefs = JSON.parse(data.project.global_preferences);
            if (prefs.wizardCompleted) {
              setWizardCompleted(true);
            }
          } catch {
            // Ignore parse errors
          }
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
          
          // Debug: Log what frontend receives
          console.log('=== FRONTEND RECEIVED IMAGES ===');
          if (data.images) {
            data.images.forEach((img: any, index: number) => {
              console.log(`Frontend Image ${index}:`, {
                id: img.id,
                url: img.url,
                detected_items: img.detected_items,
                detected_items_type: typeof img.detected_items,
                detected_items_length: img.detected_items?.length,
                detected_items_is_null: img.detected_items === null,
                detected_items_is_undefined: img.detected_items === undefined,
                detected_items_is_empty: img.detected_items === '',
                all_keys: Object.keys(img),
                full_object: img,
              });
            });
          }
          
          setRoomImages(data.images || []);
          if (data.images?.length > 0) {
            setCurrentImageIndex(0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch room images:', error);
      }
    }

    fetchRoomImages();
  }, [selectedRoomId]);

  // REQUIREMENT 1: Handle image generation from chat - IMMEDIATE state update
  const handleImageGenerated = async (imageUrl: string, detectedObjects: any[]) => {
    // REQUIREMENT 2: Handle detectedObjects correctly - null means not detected, [] means empty
    const detectedItemsJson = Array.isArray(detectedObjects) && detectedObjects.length > 0
      ? JSON.stringify(detectedObjects)
      : '[]';
    
    // IMMEDIATELY create and display the image (don't wait for API)
    const tempImage: RoomImage = {
      id: Date.now(), // Temporary ID (will be replaced when API syncs)
      url: imageUrl,
      prompt: 'Generated image',
      view_type: 'perspective',
      detected_items: detectedItemsJson,
      created_at: new Date().toISOString(),
    };
    
    // CRITICAL: Stop generation animation FIRST, then update images
    // This ensures the render guard sees roomImages.length > 0 immediately
    setIsGenerating(false);
    
    // REQUIREMENT 1: Update state IMMEDIATELY - this triggers UI update
    setRoomImages([tempImage, ...roomImages]);
    setCurrentImageIndex(0); // Show the latest image
    
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
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (res.ok) {
          const data = await res.json();
          const newImages = data.images || [];
          // Update with real data from API (includes proper IDs, etc.)
          if (newImages.length > 0) {
            setRoomImages(newImages);
            setCurrentImageIndex(0);
          }
        }
      } catch (error) {
        // Silent fail - we already have the image displayed
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
        }
      } catch (error) {
        // Silently fail polling
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [selectedRoomId, roomImages.length]);

  const handleRoomSelect = (roomId: number) => {
    setSelectedRoomId(roomId);
  };

  const handleUploadComplete = (data: {
    floor_plan_url: string;
    annotated_floor_plan_url: string;
    rooms: any[];
    room_count: number;
    total_area_sqft: number;
  }) => {
    if (project) {
      setProject({
        ...project,
        floor_plan_url: data.floor_plan_url,
        annotated_floor_plan_url: data.annotated_floor_plan_url,
      });
    }
    // Reload to show detected rooms
    window.location.reload();
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
    setSelectedObject({ id: object.id, label: object.label });
    
    // Auto-focus chat input and prepend object context
    // The chat placeholder will show "Editing [object]..." which guides the user
  };

  // Handle wizard completion
  const handleWizardComplete = async (data: WizardSummaryData) => {
    setWizardData(data);
    setWizardCompleted(true);
    
    // Update local project state with new preferences
    const newPrefs = {
      buildingType: data.buildingType,
      architectureStyle: data.architectureStyle,
      atmosphere: data.atmosphere,
      constraints: data.constraints,
      customNotes: data.customNotes,
      wizardCompleted: true,
    };
    
    if (project) {
      setProject({ ...project, global_preferences: JSON.stringify(newPrefs) });
    }
    
    // If rooms exist (floor plan uploaded), generate images and move to step 2
    if (rooms.length > 0) {
      setIsGenerating(true);
      
      // Generate an image for each room
      const generatePromises = rooms.map(async (room) => {
        try {
          // Build description based on room type and project preferences
          const style = data.architectureStyle || 'modern';
          const atmosphere = data.atmosphere || 'bright and airy';
          const description = `A ${atmosphere} ${style} ${room.type || room.name}, interior design visualization, professional photography, high quality`;
          
          const res = await fetch(`/api/rooms/${room.id}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description,
              viewType: 'perspective',
              style: data.architectureStyle,
            }),
          });
          
          if (!res.ok) {
            console.error(`Failed to generate image for room ${room.name}`);
          }
          
          return res.ok;
        } catch (error) {
          console.error(`Error generating image for room ${room.name}:`, error);
          return false;
        }
      });
      
      // Wait for all generations to complete
      await Promise.all(generatePromises);
      
      setIsGenerating(false);
      
      // Refresh to show the design step with generated images
      router.refresh();
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

  // Show generating overlay when creating initial room images
  if (isGenerating && wizardCompleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="animate-spin w-12 h-12 border-3 border-accent-warm border-t-transparent rounded-full" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Generating Room Designs</h2>
          <p className="text-white/60">Creating visualizations for {rooms.length} room{rooms.length !== 1 ? 's' : ''}...</p>
          <p className="text-white/40 text-sm mt-2">This may take a minute</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  // Step 1: Combined Upload + Design Brief Wizard
  if (currentStep === 1) {
    return (
      <div className="page-shell">
        <Header showSteps currentStep={1} />

        <main className="page-main">
          <div className="max-w-[1500px] mx-auto">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-white/60 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to projects
            </Link>

            <h1 className="text-2xl font-bold text-white mb-6">{project.name}</h1>

            <div className="grid lg:grid-cols-2 gap-6 h-[780px]">
              {/* Left column: Upload + Design Brief Status */}
              <div className="flex flex-col gap-6 h-full">
                {/* Floor Plan Upload Widget */}
                <div className="panel flex-1 flex flex-col overflow-hidden">
                  <div className="panel-header flex-shrink-0">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Upload className="w-5 h-5 text-accent-warm" />
                      Add Your Space
                    </h2>
                </div>
                  <div className="panel-body flex-1 overflow-y-auto">
                  {!setupMode ? (
                    <div className="grid gap-4">
                      <button
                        onClick={() => setSetupMode('upload')}
                          className="p-5 border border-white/20 rounded-lg hover:border-accent-warm hover:bg-accent-warm/10 transition-colors text-left"
                      >
                          <Upload className="w-7 h-7 mb-3 text-accent-warm" />
                          <h3 className="font-semibold mb-1 text-white">Upload Floor Plan</h3>
                        <p className="text-sm text-white/60">
                            Upload a PDF or image and we&apos;ll detect the rooms
                        </p>
                      </button>

                      <button
                        onClick={() => setSetupMode('manual')}
                          className="p-5 border border-white/20 rounded-lg hover:border-accent-warm hover:bg-accent-warm/10 transition-colors text-left"
                      >
                          <Edit3 className="w-7 h-7 mb-3 text-accent-warm" />
                          <h3 className="font-semibold mb-1 text-white">Enter Manually</h3>
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
                      <ServiceStatusBanner />
                      <FloorplanUploader
                        projectId={projectId}
                        onUploadComplete={handleUploadComplete}
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

                {/* Completion Status Widget - Live Updates */}
                <div className="panel flex-shrink-0">
                  <div className="panel-header flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      Completion
                    </h2>
                    {/* Circular progress tracker */}
                    {(() => {
                      const completedSteps = [
                        wizardProgress?.buildingType,
                        wizardProgress?.architectureStyle,
                        wizardProgress?.atmosphere,
                        wizardProgress?.currentStep === 'complete',
                      ].filter(Boolean).length;
                      const totalSteps = 4;
                      const progress = completedSteps / totalSteps;
                      const circumference = 2 * Math.PI * 14;
                      const strokeDashoffset = circumference * (1 - progress);
                      
                      return (
                        <div className="relative w-10 h-10 flex items-center justify-center">
                          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                            {/* Background circle */}
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              className="text-white/10"
                            />
                            {/* Progress circle */}
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              className="text-accent-warm transition-all duration-500 ease-out"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                            />
                          </svg>
                          <span className="absolute text-xs font-semibold text-white">
                            {completedSteps}/{totalSteps}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="panel-body space-y-4">
                    {/* Building Type */}
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        wizardProgress?.buildingType 
                          ? 'bg-accent-warm text-black' 
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {wizardProgress?.buildingType ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <span className="text-xs font-medium">1</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80">Building type</p>
                        {wizardProgress?.buildingType ? (
                          <p className="text-sm text-accent-warm truncate">
                            {getOptionLabel(BUILDING_TYPE_OPTIONS, wizardProgress.buildingType)}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40">Not set</p>
                        )}
                      </div>
                    </div>

                    {/* Architecture Style */}
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        wizardProgress?.architectureStyle 
                          ? 'bg-accent-warm text-black' 
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {wizardProgress?.architectureStyle ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <span className="text-xs font-medium">2</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80">Style</p>
                        {wizardProgress?.architectureStyle ? (
                          <p className="text-sm text-accent-warm truncate">
                            {getOptionLabel(ARCHITECTURE_STYLE_OPTIONS, wizardProgress.architectureStyle)}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40">Not set</p>
                        )}
                      </div>
                    </div>

                    {/* Atmosphere */}
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        wizardProgress?.atmosphere
                          ? 'bg-accent-warm text-black' 
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {wizardProgress?.atmosphere ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <span className="text-xs font-medium">3</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80">Atmosphere</p>
                        {wizardProgress?.atmosphere ? (
                          <p className="text-sm text-accent-warm truncate">
                            {getOptionLabel(ATMOSPHERE_OPTIONS, wizardProgress.atmosphere)}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40">Not set</p>
                        )}
                      </div>
                    </div>

                    {/* Preferences */}
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        wizardProgress?.currentStep === 'complete'
                          ? 'bg-accent-warm text-black' 
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {wizardProgress?.currentStep === 'complete' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <span className="text-xs font-medium">4</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80">Preferences</p>
                        {wizardProgress?.constraints && wizardProgress.constraints.length > 0 ? (
                          <p className="text-sm text-accent-warm truncate">
                            {wizardProgress.constraints.map(c => 
                              getOptionLabel(CONSTRAINT_OPTIONS, c)
                            ).join(', ')}
                          </p>
                        ) : wizardProgress?.currentStep === 'complete' ? (
                          <p className="text-sm text-accent-warm">No constraints</p>
                        ) : (
                          <p className="text-xs text-white/40">Not set</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Design Brief Wizard Chat */}
              <DesignBriefWizard
                projectId={projectId}
                onComplete={handleWizardComplete}
                onStateChange={setWizardProgress}
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
          <div className="w-full max-w-[1500px] mx-auto px-6 lg:px-8 pt-6 pb-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
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
                  <RoomGrid
                    rooms={rooms.map((r) => ({ ...r, approved: r.approved === 1 }))}
                    selectedRoomId={selectedRoomId}
                    onSelectRoom={handleRoomSelect}
                  />
                </div>
              </div>

              {/* Floor plan viewer card - optional, shown if floor plan exists */}
              {project.floor_plan_url && (
                <div className="panel">
                  <div className="p-4">
                    <h3 className="font-semibold text-white text-sm mb-4">Floor Plan</h3>
                    <FloorPlanToggle
                      floorPlanUrl={project.floor_plan_url}
                      annotatedFloorPlanUrl={project.annotated_floor_plan_url}
                    />
                  </div>
                </div>
              )}

              {/* Chat panel card - stacked below room selection */}
              <div className="flex flex-col min-h-0 flex-1">
                <ChatWrapper
                  projectId={projectId}
                  roomId={selectedRoomId}
                  selectedObjectId={selectedObject?.id || null}
                  onEditImage={handleEditImage}
                  onLoadingChange={setIsGenerating}
                  onImageGenerated={handleImageGenerated}
                  placeholder={
                    selectedObject
                      ? `Editing ${selectedObject.label}...`
                      : `Describe your vision for the ${selectedRoom?.name || 'room'}...`
                  }
                />
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
                        onIndexChange={setCurrentImageIndex}
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
        <div className="max-w-[1500px] mx-auto">
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

// Step indicator for wizard intro
function StepIndicator({
  number,
  label,
  active = false,
}: {
  number: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          active
            ? 'bg-accent-warm text-black'
            : 'bg-white/10 text-white/40'
        }`}
      >
        {number}
      </div>
      <span className={active ? 'text-white font-medium' : 'text-white/50'}>
        {label}
      </span>
    </div>
  );
}

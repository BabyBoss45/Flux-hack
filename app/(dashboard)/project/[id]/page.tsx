'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Share2, Upload, Edit3, Check, Image as ImageIcon, ShoppingCart, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { RoomGrid } from '@/components/rooms/room-grid';
import { RoomImageViewer } from '@/components/rooms/room-image-viewer';
import { ChatWrapper } from '@/components/chat/chat-wrapper';
import { FloorplanUploader } from '@/components/floorplan/floorplan-uploader';
import { ManualRoomEntry } from '@/components/floorplan/manual-room-entry';
import { ServiceStatusBanner } from '@/components/floorplan/service-status-banner';
import { FloorPlanToggle } from '@/components/floorplan/floor-plan-toggle';
import { PreferencesDialog } from '@/components/project/preferences-dialog';
import { ShareDialog } from '@/components/project/share-dialog';
import { ImageGeneration } from '@/components/ui/ai-chat-image-generation-1';
import { DesignBriefWizard } from '@/components/wizard/design-brief-wizard';
import type { WizardSummaryData } from '@/lib/wizard/types';

interface Project {
  id: number;
  name: string;
  floor_plan_url: string | null;
  annotated_floor_plan_url: string | null;
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
  is_final: number;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);

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

  // Fetch room images when room changes - auto-generate if none exist
  useEffect(() => {
    if (!selectedRoomId) return;

    async function fetchRoomImages() {
      try {
        const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (res.ok) {
          const data = await res.json();
          const images = data.images || [];
          
          setRoomImages(images);
          if (images.length > 0) {
            setCurrentImageIndex(0);
          } else if (selectedRoomId) {
            // No images yet - auto-generate based on user brief
            autoGenerateForRoom(selectedRoomId);
          }
        }
      } catch (error) {
        console.error('Failed to fetch room images:', error);
      }
    }

    fetchRoomImages();
  }, [selectedRoomId]);

  // Auto-generate image for a room using user's design brief
  const autoGenerateForRoom = async (roomId: number) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Skip utility rooms
    const utilityTypes = ['closet', 'storage', 'utility', 'laundry', 'garage', 'hallway', 'corridor'];
    if (utilityTypes.some(t => room.type.toLowerCase().includes(t))) {
      console.log('[AutoGen] Skipping utility room:', room.name);
      return;
    }
    
    // Check if already generating
    if (isGenerating) return;
    
    setIsGenerating(true);
    console.log('[AutoGen] Auto-generating image for:', room.name);
    
    // Build prompt from user preferences
    const prefs = project?.global_preferences ? JSON.parse(project.global_preferences) : {};
    const style = prefs.architectureStyle || 'modern';
    const atmosphere = prefs.atmosphere || 'elegant';
    const buildingType = prefs.buildingType || 'apartment';
    const constraintsText = prefs.constraints?.join(', ') || '';
    const customNotes = prefs.customNotes || '';
    
    const prompt = `A beautiful ${style} ${room.type} in a ${buildingType}. ${atmosphere} atmosphere with carefully chosen furniture and decor. ${constraintsText ? `Design considerations: ${constraintsText}.` : ''} ${customNotes ? customNotes : ''} Professional interior design photography, photorealistic, high quality, detailed textures, natural lighting.`;
    
    try {
      const res = await fetch(`/api/rooms/${roomId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: prompt,
          viewType: 'perspective',
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[AutoGen] Image generated for:', room.name);
        
        if (data.imageUrl) {
          // Update images immediately
          const newImage: RoomImage = {
            id: Date.now(),
            url: data.imageUrl,
            prompt: prompt,
            view_type: 'perspective',
            detected_items: '[]',
            is_final: 0,
            created_at: new Date().toISOString(),
          };
          setRoomImages([newImage]);
          setCurrentImageIndex(0);
        }
      }
    } catch (err) {
      console.error('[AutoGen] Error generating image:', err);
    } finally {
      setIsGenerating(false);
    }
  };

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
      is_final: 0,
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

  const handleUploadComplete = async (data: {
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
    
    // Update rooms state immediately so wizard knows rooms are available
    if (data.rooms && data.rooms.length > 0) {
      setRooms(data.rooms.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type || r.room_type || 'room',
        approved: 0,
      })));
    }
    
    // Fetch FRESH project data from API to get latest preferences
    // (the wizard may have saved preferences that aren't in our stale state)
    let freshPrefs: any = {};
    try {
      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (projectRes.ok) {
        const freshProject = await projectRes.json();
        freshPrefs = freshProject.project?.global_preferences 
          ? JSON.parse(freshProject.project.global_preferences) 
          : {};
        console.log('[Upload] Fetched fresh preferences:', freshPrefs);
      }
    } catch (err) {
      console.error('[Upload] Failed to fetch fresh project data:', err);
    }
    
    // Auto-generate images for detected rooms using FRESH preferences
    if (data.rooms && data.rooms.length > 0 && freshPrefs.architectureStyle) {
      console.log('[Upload] Auto-generating images for', data.rooms.length, 'detected rooms');
      
      const style = freshPrefs.architectureStyle || 'modern';
      const atmosphere = freshPrefs.atmosphere || 'elegant';
      const buildingType = freshPrefs.buildingType || 'apartment';
      const constraintsText = freshPrefs.constraints?.join(', ') || '';
      const customNotes = freshPrefs.customNotes || '';
      
      for (const room of data.rooms) {
        // Skip utility rooms
        const utilityTypes = ['closet', 'storage', 'utility', 'laundry', 'garage', 'hallway', 'corridor'];
        const roomType = room.type || room.room_type || '';
        if (utilityTypes.some(t => roomType.toLowerCase().includes(t))) {
          console.log('[Upload] Skipping utility room:', room.name);
          continue;
        }
        
        const prompt = `A ${style} ${roomType} in a ${buildingType}, ${atmosphere} atmosphere. ${constraintsText ? `Design considerations: ${constraintsText}.` : ''} ${customNotes ? `Additional notes: ${customNotes}` : ''} Professional interior design photography, high quality, detailed.`;
        
        console.log('[Upload] Generating image for room:', room.name);
        
        // Generate image and wait
        try {
          const res = await fetch(`/api/rooms/${room.id}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: prompt,
              viewType: 'perspective',
            }),
          });
          if (res.ok) {
            console.log('[Upload] Image generated for:', room.name);
          }
        } catch (err) {
          console.error('[Upload] Error generating image for:', room.name, err);
        }
      }
      console.log('[Upload] All images generated');
    } else {
      console.log('[Upload] Skipping auto-generation - waiting for wizard completion. Has rooms:', data.rooms?.length, 'Has style:', !!freshPrefs.architectureStyle);
    }
    
    // Reload to show detected rooms with images
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

  // Handle image added from canvas editor
  const handleImageAdded = (imageUrl: string) => {
    // Create a temporary image to display immediately
    const newImage: RoomImage = {
      id: Date.now(),
      url: imageUrl,
      prompt: '[Inpaint] Edited image',
      view_type: 'variation',
      detected_items: '[]',
      is_final: 0,
      created_at: new Date().toISOString(),
    };
    setRoomImages([newImage, ...roomImages]);
    setCurrentImageIndex(0);

    // Sync with API in background
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
        if (res.ok) {
          const data = await res.json();
          const newImages = data.images || [];
          if (newImages.length > 0) {
            setRoomImages(newImages);
            setCurrentImageIndex(0);
          }
        }
      } catch (error) {
        // Silent fail
      }
    }, 1000);
  };

  // Handle wizard completion - save preferences and auto-generate images for all rooms
  const handleWizardComplete = async (data: WizardSummaryData) => {
    console.log('[Wizard] Complete with data:', data);
    
    // Save preferences to project
    const preferences = {
      buildingType: data.buildingType,
      architectureStyle: data.architectureStyle,
      atmosphere: data.atmosphere,
      constraints: data.constraints,
      customNotes: data.customNotes,
    };
    
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_preferences: JSON.stringify(preferences) }),
    });

    if (project) {
      setProject({ ...project, global_preferences: JSON.stringify(preferences) });
    }

    // Fetch fresh rooms from API in case state is stale
    let roomsToGenerate = rooms;
    if (rooms.length === 0) {
      console.log('[Wizard] No rooms in state, fetching from API...');
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const freshData = await res.json();
          roomsToGenerate = freshData.rooms || [];
          console.log('[Wizard] Fetched', roomsToGenerate.length, 'rooms from API');
        }
      } catch (err) {
        console.error('[Wizard] Failed to fetch rooms:', err);
      }
    }

    // If rooms exist, auto-generate images for each room
    if (roomsToGenerate.length > 0) {
      console.log('[Wizard] Auto-generating images for', roomsToGenerate.length, 'rooms');
      
      // Build prompt from preferences
      const style = data.architectureStyle || 'modern';
      const atmosphere = data.atmosphere || 'elegant';
      const buildingType = data.buildingType || 'apartment';
      const constraintsText = data.constraints?.join(', ') || '';
      const customNotes = data.customNotes || '';
      
      // Generate images for each room
      for (const room of roomsToGenerate) {
        // Skip utility rooms
        const utilityTypes = ['closet', 'storage', 'utility', 'laundry', 'garage', 'hallway', 'corridor'];
        const roomType = room.type || 'room';
        if (utilityTypes.some(t => roomType.toLowerCase().includes(t))) {
          console.log('[Wizard] Skipping utility room:', room.name);
          continue;
        }
        
        const prompt = `A ${style} ${roomType} in a ${buildingType}, ${atmosphere} atmosphere. ${constraintsText ? `Design considerations: ${constraintsText}.` : ''} ${customNotes ? `Additional notes: ${customNotes}` : ''} Professional interior design photography, high quality, detailed.`;
        
        console.log('[Wizard] Generating image for room:', room.name, 'with prompt:', prompt);
        
        // Generate image and wait for it
        try {
          const res = await fetch(`/api/rooms/${room.id}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: prompt,
              viewType: 'perspective',
            }),
          });
          if (res.ok) {
            console.log('[Wizard] Image generated for:', room.name);
          } else {
            console.error('[Wizard] Failed to generate image for:', room.name);
          }
        } catch (err) {
          console.error('[Wizard] Error generating image for:', room.name, err);
        }
      }
      
      console.log('[Wizard] All images generated, refreshing...');
      // Refresh page to show Step 2 with images
      window.location.reload();
    } else {
      console.log('[Wizard] No rooms available for image generation');
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const preferences = project?.global_preferences
    ? JSON.parse(project.global_preferences)
    : {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-[#00ff9d] border-t-transparent rounded-full shadow-[0_0_15px_rgba(0,255,157,0.3)]" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  // Step 1: Upload / Setup - Full width modern layout
  if (currentStep === 1) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSteps currentStep={1} />

        <main className="flex-1 flex overflow-hidden">
          {/* Full width container */}
          <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 py-6 flex flex-col">
            {/* Header row */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-6">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[rgba(0,255,157,0.05)] border border-[rgba(0,255,157,0.15)] hover:bg-[rgba(0,255,157,0.1)] hover:border-[rgba(0,255,157,0.3)] text-white/60 hover:text-[#00ff9d] transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
                  <p className="text-sm text-white/40 mt-0.5">Configure your space and design preferences</p>
                </div>
              </div>
            </div>

            {/* Main content - 2 column layout with fixed height */}
            <div className="flex-1 grid lg:grid-cols-2 gap-8 min-h-0 max-h-[calc(100vh-180px)] overflow-hidden">
              {/* Left: Upload panel - larger */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                <div className="panel flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-5 border-b border-[rgba(0,255,157,0.1)]">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Upload className="w-5 h-5 text-[#00ff9d]" />
                      Add Your Space
                    </h2>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto">
                    {!setupMode ? (
                      <div className="grid gap-4 h-full">
                        <button
                          onClick={() => setSetupMode('upload')}
                          className="group relative p-8 border border-[rgba(0,255,157,0.15)] rounded-2xl hover:border-[rgba(0,255,157,0.4)] hover:bg-[rgba(0,255,157,0.05)] hover:shadow-[0_0_30px_rgba(0,255,157,0.1)] transition-all duration-300 text-left flex flex-col"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.2)] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(0,255,157,0.3)] transition-all">
                            <Upload className="w-7 h-7 text-[#00ff9d]" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-[#00ff9d] transition-colors">Upload Floor Plan</h3>
                          <p className="text-sm text-white/50 leading-relaxed">
                            Upload a PDF or image of your floor plan and we&apos;ll automatically detect all rooms
                          </p>
                          <div className="mt-auto pt-4">
                            <span className="text-xs text-[#00ff9d]/70 font-medium">Recommended</span>
                          </div>
                        </button>

                        <button
                          onClick={() => setSetupMode('manual')}
                          className="group relative p-8 border border-[rgba(255,255,255,0.08)] rounded-2xl hover:border-[rgba(0,255,157,0.25)] hover:bg-[rgba(0,255,157,0.03)] transition-all duration-300 text-left flex flex-col"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:border-[rgba(0,255,157,0.2)] transition-all">
                            <Edit3 className="w-7 h-7 text-white/60 group-hover:text-[#00ff9d] transition-colors" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-white/90 transition-colors">Enter Manually</h3>
                          <p className="text-sm text-white/50 leading-relaxed">
                            Manually enter the rooms in your space if you don&apos;t have a floor plan
                          </p>
                        </button>
                      </div>
                    ) : setupMode === 'upload' ? (
                      <div className="h-full flex flex-col">
                        <Button
                          variant="ghost"
                          onClick={() => setSetupMode(null)}
                          className="mb-6 text-white/60 hover:text-white hover:bg-white/5 w-fit -ml-2"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back to options
                        </Button>
                        <ServiceStatusBanner />
                        <div className="flex-1">
                          <FloorplanUploader
                            projectId={projectId}
                            onUploadComplete={handleUploadComplete}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col">
                        <Button
                          variant="ghost"
                          onClick={() => setSetupMode(null)}
                          className="mb-6 text-white/60 hover:text-white hover:bg-white/5 w-fit -ml-2"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back to options
                        </Button>
                        <ManualRoomEntry
                          projectId={projectId}
                          onComplete={handleRoomsDetected}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Design Brief Wizard - larger with better styling */}
              <div className="flex flex-col min-h-0">
                <div className="panel flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <DesignBriefWizard
                      projectId={projectId}
                      onComplete={handleWizardComplete}
                      hasFloorPlan={!!project.floor_plan_url}
                      roomCount={rooms.length}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Step 2: Design
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
        <Header showSteps currentStep={2} />

        <main className="flex-1 flex overflow-hidden">
          {/* Full width 3-column layout */}
          <div className="w-full max-w-[1920px] mx-auto px-4 lg:px-6 py-4 flex gap-4 h-full">
            
            {/* Left sidebar: Rooms + Brief + Floor Plan */}
            <div className="w-[200px] flex-shrink-0 flex flex-col gap-3 overflow-hidden">
              {/* Progress indicator */}
              <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-white/50 font-medium">PROGRESS</span>
                  <span className="text-[10px] text-white/70 font-medium">
                    {rooms.filter(r => r.approved === 1).length}/{rooms.length} saved
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${rooms.length > 0 ? (rooms.filter(r => r.approved === 1).length / rooms.length) * 100 : 0}%` }}
                  />
                </div>
                {rooms.length > 0 && rooms.every(r => r.approved === 1) && (
                  <Button
                    onClick={() => router.push(`/project/${projectId}/finalize`)}
                    className="w-full mt-3 bg-green-600 hover:bg-green-500 text-white text-xs font-medium py-2 rounded-lg"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Go to Finalize
                  </Button>
                )}
              </div>

              {/* Room selector */}
              <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-medium text-white text-xs truncate">{project.name}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreferencesOpen(true)}
                    className="text-white/50 hover:text-white hover:bg-white/10 h-6 w-6 p-0"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </div>
                <RoomGrid
                  rooms={rooms.map((r) => ({ ...r, approved: r.approved === 1 }))}
                  selectedRoomId={selectedRoomId}
                  onSelectRoom={handleRoomSelect}
                />
              </div>

              {/* Design Brief - collapsible */}
              <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl overflow-hidden">
                <button
                  onClick={() => setBriefExpanded(!briefExpanded)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-white">Brief</span>
                  </div>
                  {briefExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                  )}
                </button>
                {briefExpanded && (
                  <div className="px-3 pb-3 space-y-1.5 border-t border-white/[0.06] pt-2">
                    {preferences.architectureStyle && (
                      <div className="text-[10px]"><span className="text-white/40">Style:</span> <span className="text-white/70">{preferences.architectureStyle}</span></div>
                    )}
                    {preferences.atmosphere && (
                      <div className="text-[10px]"><span className="text-white/40">Mood:</span> <span className="text-white/70">{preferences.atmosphere}</span></div>
                    )}
                    {preferences.buildingType && (
                      <div className="text-[10px]"><span className="text-white/40">Type:</span> <span className="text-white/70">{preferences.buildingType}</span></div>
                    )}
                    {preferences.constraints?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {preferences.constraints.map((c: string) => (
                          <span key={c} className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] text-white/50">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Floor plan */}
              {project.floor_plan_url && (
                <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl p-3">
                  <h3 className="text-[10px] font-medium text-white/50 mb-2">FLOOR PLAN</h3>
                  <FloorPlanToggle
                    floorPlanUrl={project.floor_plan_url}
                    annotatedFloorPlanUrl={project.annotated_floor_plan_url}
                  />
                </div>
              )}
            </div>

            {/* Center: Image viewer */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl flex-1 flex flex-col overflow-hidden">
                {/* Image header */}
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-[#0a0a0a]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{selectedRoom?.name || 'Select a room'}</h3>
                      <p className="text-[10px] text-white/40">{selectedRoom?.type || 'Room design'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {roomImages.length > 0 && (
                      <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">
                        v{currentImageIndex + 1}/{roomImages.length}
                      </span>
                    )}
                    {roomImages.length > 0 && selectedRoom && (
                      selectedRoom.approved === 1 ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 text-xs font-medium rounded-lg">
                          <Check className="w-3.5 h-3.5" />
                          Saved
                        </span>
                      ) : (
                        <Button
                          onClick={async () => {
                            try {
                              await fetch(`/api/rooms/${selectedRoom.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ approved: true }),
                              });
                              // Update local state
                              setRooms(rooms.map(r => 
                                r.id === selectedRoom.id ? { ...r, approved: 1 } : r
                              ));
                              // Check if all rooms are now approved
                              const updatedRooms = rooms.map(r => 
                                r.id === selectedRoom.id ? { ...r, approved: 1 } : r
                              );
                              if (updatedRooms.every(r => r.approved === 1)) {
                                router.push(`/project/${projectId}/finalize`);
                              }
                            } catch (err) {
                              console.error('Failed to save room:', err);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save Final
                        </Button>
                      )
                    )}
                  </div>
                </div>
                
                {/* Image area */}
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                  {roomImages.length > 0 ? (
                    <div className="w-full h-full flex items-center justify-center relative">
                      {isImageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-lg backdrop-blur-sm">
                          <div className="text-center text-white/70 text-sm">Loading...</div>
                        </div>
                      )}
                      <RoomImageViewer
                        images={roomImages}
                        currentIndex={currentImageIndex}
                        onIndexChange={setCurrentImageIndex}
                        roomId={selectedRoomId}
                        onImageAdded={handleImageAdded}
                        onImageLoad={() => setIsImageLoading(false)}
                      />
                    </div>
                  ) : isGenerating ? (
                    <ImageGeneration className="w-full h-full max-w-[900px]">
                      <div className="flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-xl w-full aspect-[4/3] max-h-full border border-amber-500/10">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 animate-pulse">
                          <Sparkles className="w-6 h-6 text-amber-400" />
                        </div>
                        <p className="text-white/60 text-sm">Generating design for {selectedRoom?.name}...</p>
                        <p className="text-white/30 text-xs mt-1">This may take 10-30 seconds</p>
                      </div>
                    </ImageGeneration>
                  ) : (
                    <div className="flex flex-col items-center justify-center bg-white/[0.02] rounded-xl w-full aspect-[4/3] max-w-[700px] max-h-full border border-dashed border-white/10">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <ImageIcon className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-white/50 text-sm font-medium mb-1">No design yet</p>
                      <p className="text-white/30 text-xs">Use the chat to describe your vision →</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right sidebar: Chat for this room */}
            <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden">
              <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl flex-1 flex flex-col overflow-hidden">
                {/* Chat header */}
                <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0a0a0a]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Flux AI Designer</h3>
                      <p className="text-[10px] text-white/40">Generate • Edit • Analyze</p>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="px-3 py-2 border-b border-white/[0.06] flex gap-2 overflow-x-auto">
                  <button className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full whitespace-nowrap transition-colors">
                    ✨ Generate
                  </button>
                  <button className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full whitespace-nowrap transition-colors">
                    🎨 Edit style
                  </button>
                  <button className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full whitespace-nowrap transition-colors">
                    🔍 Analyze
                  </button>
                  <button className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full whitespace-nowrap transition-colors">
                    🛋️ Furniture
                  </button>
                </div>
                
                {/* Chat panel */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ChatWrapper
                    projectId={projectId}
                    roomId={selectedRoomId}
                    onLoadingChange={setIsGenerating}
                    onImageGenerated={handleImageGenerated}
                    placeholder={`Describe your ${selectedRoom?.name || 'room'} design...`}
                  />
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
                <Button>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Shop Furniture
                </Button>
              </Link>
              <Button
                onClick={() => setShareOpen(true)}
                variant="outline"
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
          <ImageIcon className="w-8 h-8 text-white/20" />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-white">{room.name}</h3>
        <p className="text-sm text-white/50">{room.type}</p>
      </div>
    </button>
  );
}

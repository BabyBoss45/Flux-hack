'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';

interface RoomImage {
  id: number;
  url: string;
  prompt: string;
  view_type: string;
  detected_items: string[];
}

interface Room {
  id: number;
  name: string;
  type: string;
  images: RoomImage[];
}

interface SharedDesignViewProps {
  projectName: string;
  preferences: Record<string, string>;
  rooms: Room[];
}

export function SharedDesignView({ projectName, preferences, rooms }: SharedDesignViewProps) {
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const currentRoom = rooms[selectedRoomIndex];
  const currentImage = currentRoom?.images[selectedImageIndex];

  const handlePrevRoom = () => {
    if (selectedRoomIndex > 0) {
      setSelectedRoomIndex(selectedRoomIndex - 1);
      setSelectedImageIndex(0);
    }
  };

  const handleNextRoom = () => {
    if (selectedRoomIndex < rooms.length - 1) {
      setSelectedRoomIndex(selectedRoomIndex + 1);
      setSelectedImageIndex(0);
    }
  };

  const handleDownload = async () => {
    if (!currentImage) return;

    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentRoom.name}-design-${currentImage.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="page-shell">
      <Header />

      {/* Project info bar */}
      <div className="border-b border-white/10 bg-surface/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50 mb-1">Shared Design</p>
              <h1 className="text-xl font-semibold text-white">{projectName}</h1>
            </div>
            <div className="flex gap-2">
              {preferences.style && (
                <span className="chip chip-active">{preferences.style}</span>
              )}
              {preferences.colors && (
                <span className="chip chip-muted">{preferences.colors}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Room navigation */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevRoom}
                disabled={selectedRoomIndex === 0}
                className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="font-semibold text-white">{currentRoom?.name}</p>
                <p className="text-xs text-white/50">
                  Room {selectedRoomIndex + 1} of {rooms.length}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextRoom}
                disabled={selectedRoomIndex === rooms.length - 1}
                className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Room pills */}
            <div className="hidden md:flex gap-2">
              {rooms.map((room, index) => (
                <button
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomIndex(index);
                    setSelectedImageIndex(0);
                  }}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    index === selectedRoomIndex
                      ? 'bg-accent-warm text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {room.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="page-main">
        <div className="max-w-4xl mx-auto">
          {currentImage ? (
            <>
              {/* Main image panel */}
              <div className="panel overflow-hidden">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="w-full relative group cursor-zoom-in">
                      <img
                        src={currentImage.url}
                        alt={currentImage.prompt}
                        className="w-full h-auto"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="w-8 h-8 text-white" />
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl bg-surface border-white/10">
                    <img
                      src={currentImage.url}
                      alt={currentImage.prompt}
                      className="w-full h-auto rounded-lg"
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {/* Image info */}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">{currentImage.prompt}</p>
                  <p className="text-xs text-white/50 mt-1">
                    {currentImage.view_type} view
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>

              {/* Detected items */}
              {currentImage.detected_items?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-white mb-2">Featured Items</p>
                  <div className="flex flex-wrap gap-2">
                    {currentImage.detected_items.map((item, index) => (
                      <span key={index} className="chip chip-muted">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Thumbnail strip */}
              {currentRoom.images.length > 1 && (
                <div className="mt-6 flex gap-2 overflow-x-auto py-2">
                  {currentRoom.images.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-colors ${
                        index === selectedImageIndex
                          ? 'border-accent-warm'
                          : 'border-transparent hover:border-white/30'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/50">No images for this room</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, Download, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Home className="w-4 h-4" />
                Shared Design
              </div>
              <h1 className="text-2xl font-bold">{projectName}</h1>
            </div>
            <div className="flex gap-2">
              {preferences.style && (
                <Badge variant="secondary">{preferences.style}</Badge>
              )}
              {preferences.colors && (
                <Badge variant="outline">{preferences.colors}</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Room navigation */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevRoom}
                disabled={selectedRoomIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="font-semibold">{currentRoom?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Room {selectedRoomIndex + 1} of {rooms.length}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextRoom}
                disabled={selectedRoomIndex === rooms.length - 1}
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
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
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
      <main className="container mx-auto px-4 py-8">
        {currentImage ? (
          <div className="max-w-4xl mx-auto">
            {/* Main image */}
            <div className="relative rounded-lg overflow-hidden bg-muted">
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
                <DialogContent className="max-w-5xl">
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
                <p className="text-sm text-muted-foreground">{currentImage.prompt}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentImage.view_type} view
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Detected items */}
            {currentImage.detected_items?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Featured Items</p>
                <div className="flex flex-wrap gap-2">
                  {currentImage.detected_items.map((item, index) => (
                    <Badge key={index} variant="secondary">
                      {item}
                    </Badge>
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
                        ? 'border-primary'
                        : 'border-transparent hover:border-muted-foreground/50'
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
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No images for this room</p>
          </div>
        )}
      </main>
    </div>
  );
}

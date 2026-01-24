'use client';

import { ChevronLeft, ChevronRight, ZoomIn, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface RoomImage {
  id: number;
  url: string;
  prompt: string;
  view_type: string;
  detected_items: string;
  created_at: string;
}

interface RoomImageViewerProps {
  images: RoomImage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function RoomImageViewer({
  images,
  currentIndex,
  onIndexChange,
}: RoomImageViewerProps) {
  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-muted-foreground">No images yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Chat with the AI to generate room designs
          </p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      onIndexChange(currentIndex + 1);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `room-design-${currentImage.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-muted/30">
      {/* Main image */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        <Dialog>
          <DialogTrigger asChild>
            <button className="relative group cursor-zoom-in">
              <img
                src={currentImage.url}
                alt={currentImage.prompt}
                className="max-h-full max-w-full rounded-lg shadow-lg"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
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

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2"
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Image info bar */}
      <div className="border-t bg-background p-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{currentImage.prompt}</p>
          <p className="text-xs text-muted-foreground">
            {currentImage.view_type} view • {new Date(currentImage.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {images.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="border-t bg-muted/50 p-2 flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => onIndexChange(index)}
              className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                index === currentIndex
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
  );
}

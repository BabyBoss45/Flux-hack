'use client';

import { ChevronLeft, ChevronRight, ZoomIn, Download, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';

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
      <div className="flex items-center justify-center min-h-[400px] max-h-[600px]">
        <div className="text-center">
          <Image className="w-8 h-8 mx-auto mb-2 text-white/30" />
          <p className="text-white/50 text-sm">No images yet</p>
          <p className="text-xs text-white/30 mt-1">
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
    <div className="flex flex-col w-full max-h-[700px]">
      {/* Main image - constrained size with breathing room */}
      <div className="relative flex items-center justify-center overflow-hidden p-4 pb-4">
        <Dialog>
          <DialogTrigger asChild>
            <button className="relative group cursor-zoom-in w-full flex items-center justify-center">
              <img
                src={currentImage.url}
                alt={currentImage.prompt}
                className="max-h-[500px] max-w-full object-contain rounded-lg shadow-lg"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <ZoomIn className="w-8 h-8 text-white" />
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl bg-surface border-white/10">
            <DialogTitle className="sr-only">
              Room image: {currentImage.prompt}
            </DialogTitle>
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
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 border-0"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 border-0"
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </Button>
          </>
        )}
      </div>

      {/* Image info bar */}
      <div className="border-t border-white/10 bg-surface/50 p-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentImage.prompt}</p>
          <p className="text-xs text-white/50">
            {currentImage.view_type} view • {new Date(currentImage.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {images.length > 1 && (
            <span className="text-xs text-white/50">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="border-t border-white/10 bg-white/5 p-2 flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => onIndexChange(index)}
              className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                index === currentIndex
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
    </div>
  );
}

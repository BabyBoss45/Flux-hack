'use client';

import { useState } from 'react';
import { Pencil, ZoomIn, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface ChatImageProps {
  imageUrl: string;
  imageId: number;
  message?: string;
  items?: string[];
  onEdit?: (imageId: number) => void;
}

export function ChatImage({ imageUrl, imageId, message, items, onEdit }: ChatImageProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `room-design-${imageId}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="relative group rounded-lg overflow-hidden border bg-muted">
        <img
          src={imageUrl}
          alt="Generated room design"
          className="w-full h-auto"
        />

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <ZoomIn className="w-4 h-4 mr-1" />
                View
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <img
                src={imageUrl}
                alt="Generated room design"
                className="w-full h-auto rounded-lg"
              />
            </DialogContent>
          </Dialog>

          {onEdit && (
            <Button size="sm" variant="secondary" onClick={() => onEdit(imageId)}>
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}

          <Button size="sm" variant="secondary" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs"
            >
              <Check className="w-3 h-3" />
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

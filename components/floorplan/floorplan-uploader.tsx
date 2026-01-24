'use client';

import { useState, useCallback } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloorplanUploaderProps {
  projectId: number;
  onUploadComplete: (url: string) => void;
  onRoomsDetected: () => void;
}

export function FloorplanUploader({
  projectId,
  onUploadComplete,
  onRoomsDetected,
}: FloorplanUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, []);

  const handleFile = (file: File) => {
    setError(null);

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or image file (PNG, JPG)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/floor-plan/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      onUploadComplete(uploadData.url);

      // Now parse the floor plan
      setParsing(true);

      const parseRes = await fetch('/api/floor-plan/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          floorPlanUrl: uploadData.url,
        }),
      });

      if (!parseRes.ok) {
        const data = await parseRes.json();
        throw new Error(data.error || 'Parsing failed');
      }

      onRoomsDetected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  return (
    <div className="w-full">
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging ? 'border-accent-warm bg-accent-warm/10' : 'border-white/20 hover:border-white/40'}
          `}
        >
          <input
            type="file"
            id="floorplan-upload"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileSelect}
          />
          <label htmlFor="floorplan-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
            <p className="text-lg font-medium mb-2 text-white">
              Drop your floor plan here
            </p>
            <p className="text-sm text-white/60 mb-4">
              or click to browse
            </p>
            <p className="text-xs text-white/40">
              Supports PDF, PNG, JPG (max 10MB)
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {preview && (
            <div className="relative aspect-video bg-white/5 rounded-lg overflow-hidden">
              <img
                src={preview}
                alt="Floor plan preview"
                className="object-contain w-full h-full"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-3">
              <File className="w-5 h-5 text-white/60" />
              <div>
                <p className="font-medium text-sm text-white">{file.name}</p>
                <p className="text-xs text-white/50">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFile}
              disabled={uploading || parsing}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || parsing}
            className="w-full bg-accent-warm hover:bg-accent-warm/90"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : parsing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Detecting rooms...
              </>
            ) : (
              'Upload & Detect Rooms'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { Upload, File, X, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetectedRoom {
  id: number;
  name: string;
  type?: string;
  room_type?: string;
}

interface FloorplanUploaderProps {
  projectId: number;
  onUploadComplete: (data: {
    floor_plan_url: string;
    annotated_floor_plan_url: string;
    rooms: DetectedRoom[];
    room_count: number;
    total_area_sqft: number;
  }) => void;
}

type UploadStatus = 'idle' | 'analyzing' | 'uploading' | 'complete' | 'error';

export function FloorplanUploader({
  projectId,
  onUploadComplete,
}: FloorplanUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
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

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large. Maximum size is 20MB.');
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

    setStatus('analyzing');
    setError(null);
    setStatusMessage('Preparing upload...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId.toString());

      const response = await fetch('/api/floor-plan/upload-and-analyse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to read response stream');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventMatch = line.match(/^event: (.+)$/m);
          const dataMatch = line.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (event === 'progress') {
              setStatus(data.status);
              setStatusMessage(data.message);
            } else if (event === 'complete') {
              setStatus('complete');
              setStatusMessage('Upload complete!');
              onUploadComplete(data);
            } else if (event === 'error') {
              setStatus('error');
              setError(data.error);
            }
          }
        }
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setStatus('idle');
    setStatusMessage('');
  };

  const isProcessing = status === 'analyzing' || status === 'uploading';

  return (
    <div className="w-full">
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer
            ${isDragging 
              ? 'border-[#00ff9d] bg-[rgba(0,255,157,0.1)] shadow-[0_0_30px_rgba(0,255,157,0.15)]' 
              : 'border-[rgba(0,255,157,0.2)] hover:border-[rgba(0,255,157,0.4)] hover:bg-[rgba(0,255,157,0.03)]'}
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.2)] flex items-center justify-center">
              <Upload className="w-8 h-8 text-[#00ff9d]" />
            </div>
            <p className="text-lg font-medium mb-2 text-white">
              Drop your floor plan here
            </p>
            <p className="text-sm text-white/50 mb-4">
              or click to browse
            </p>
            <p className="text-xs text-white/30">
              Supports PDF, PNG, JPG (max 20MB)
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {preview && (
            <div className="relative aspect-video bg-[rgba(0,255,157,0.03)] rounded-xl overflow-hidden border border-[rgba(0,255,157,0.15)]">
              <img
                src={preview}
                alt="Floor plan preview"
                className="object-contain w-full h-full"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.03)] rounded-lg border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.2)] flex items-center justify-center">
                <File className="w-5 h-5 text-[#00ff9d]" />
              </div>
              <div>
                <p className="font-medium text-sm text-white">{file.name}</p>
                <p className="text-xs text-white/40">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {status === 'idle' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {statusMessage && (
            <div className="flex items-center gap-3 p-3 bg-[rgba(0,255,157,0.05)] rounded-lg border border-[rgba(0,255,157,0.15)]">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-[#00ff9d]" />}
              {status === 'complete' && <CheckCircle className="w-4 h-4 text-[#00ff9d]" />}
              <p className="text-sm text-white">{statusMessage}</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-[rgba(255,59,92,0.1)] border border-[rgba(255,59,92,0.3)] rounded-lg">
              <p className="text-sm text-[#ff3b5c]">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus('idle')}
                className="mt-2"
              >
                Try again
              </Button>
            </div>
          )}

          {status === 'idle' && (
            <Button
              onClick={handleUpload}
              className="w-full"
            >
              Upload & Analyze with AI
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

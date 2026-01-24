"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { TagPill } from "../common/TagPill";

export function FloorplanUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const onClickUpload = () => {
    inputRef.current?.click();
  };

  return (
    <section className="panel flex-1 min-h-[420px] flex flex-col">
      <div className="panel-header">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-white/60">
            Step 1
          </p>
          <p className="text-sm text-white/80">
            Upload your floor plan & style preferences
          </p>
        </div>
      </div>
      <div className="panel-body flex flex-col gap-4">
        <div
          onClick={onClickUpload}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="relative flex-1 min-h-[220px] rounded-xl border border-dashed border-white/20 bg-black/30 flex flex-col items-center justify-center cursor-pointer hover:border-accent/70 hover:bg-black/40 transition-colors overflow-hidden"
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Uploaded floor plan"
              fill
              className="object-contain p-4"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-cyan-400/90 flex items-center justify-center text-xl">
                📐
              </div>
              <p className="text-sm font-medium text-white">
                Drop a floor plan here or click to upload
              </p>
              <p className="text-xs text-white/45">
                PNG, JPG, or PDF · We&apos;ll detect rooms and guide you
                room-by-room.
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onSelectFile}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wide">
            Style tags
          </p>
          <div className="flex flex-wrap gap-2">
            <TagPill label="Modern" muted />
            <TagPill label="Scandinavian" muted />
            <TagPill label="Warm neutrals" muted />
            <TagPill label="Minimal" muted />
            <TagPill label="Family-friendly" muted />
          </div>
          <p className="text-[11px] text-white/40">
            These will be auto-filled from your conversation, but you can also
            click to edit later.
          </p>
        </div>
      </div>
    </section>
  );
}




"use client"

import { ImageGeneration } from "@/components/ui/ai-chat-image-generation-1"

const ImageGenerationDemo = () => {
  return (
    <div className="w-full min-h-dvh flex justify-center items-center">
      <ImageGeneration>
        <img
          className="aspect-video max-w-md w-full object-cover"
          src="https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1200&q=80"
          alt="Interior design inspiration"
        />
      </ImageGeneration>
    </div>
  )
}

export default ImageGenerationDemo



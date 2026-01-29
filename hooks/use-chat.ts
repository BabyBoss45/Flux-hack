'use client';

import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';

interface UseChatOptions {
  projectId: number;
  roomId?: number | null;
  selectedObjectId?: string | null;
  initialMessages?: UIMessage[];
  onError?: (error: Error) => void;
  onImageGenerated?: (imageUrl: string, detectedObjects: unknown[]) => void;
}

// Custom transport that intercepts response headers
class ImageAwareChatTransport extends DefaultChatTransport<UIMessage> {
  constructor(options: { api: string; body: Record<string, unknown>; onImageGenerated?: (imageUrl: string, detectedObjects: unknown[]) => void; fetch?: typeof fetch }) {
    const originalFetch = options.fetch || fetch;
    const onImageGenerated = options.onImageGenerated;
    
    super({
      ...options,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        // Use custom fetch to intercept headers
        const response = await originalFetch(input, init);
        
        // Read headers immediately (before stream is consumed)
        const imageUrl = response.headers.get('X-Generated-Image-Url');
        const detectedObjectsStr = response.headers.get('X-Generated-Image-Objects');
        
        if (imageUrl && onImageGenerated) {
          try {
            const detectedObjects = detectedObjectsStr ? JSON.parse(detectedObjectsStr) : [];
            onImageGenerated(imageUrl, detectedObjects);
          } catch {
            onImageGenerated(imageUrl, []);
          }
        }
        
        return response;
      },
    });
  }
}

export function useChat({ projectId, roomId, selectedObjectId, initialMessages, onError, onImageGenerated }: UseChatOptions) {
  const chat = useAIChat({
    transport: new ImageAwareChatTransport({
      api: '/api/chat',
      body: {
        projectId,
        roomId,
        selectedObjectId,
      },
      onImageGenerated,
    }),
    initialMessages: initialMessages || [],
    onError: (error: Error) => {
      console.error('Chat error:', error);
      onError?.(error);
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return {
    messages: chat.messages,
    isLoading: chat.status === 'streaming' || chat.status === 'submitted',
    error: chat.error,
    sendMessage: (content: string) => {
      console.log('Sending message:', content.substring(0, 50));
      chat.sendMessage({ text: content });
    },
    regenerate: chat.regenerate,
    stop: chat.stop,
  };
}

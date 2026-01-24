'use client';

import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useEffect, useRef } from 'react';

interface UseChatOptions {
  projectId: number;
  roomKey: string; // CRITICAL: Required - client-side stable key (e.g., "living-room")
  selectedObjectId?: string | null;
  currentImageId: number | null; // CRITICAL: Explicit currentImageId from UI state - never inferred
  initialMessages?: UIMessage[];
  onError?: (error: Error) => void;
  onImageGenerated?: (imageUrl: string, detectedObjects: any[]) => void;
}

// Custom transport that intercepts request/response and builds body at request time
// CRITICAL: Overrides fetch to inject body from ref, avoiding stale closure
class ImageAwareChatTransport extends DefaultChatTransport {
  private onImageGenerated?: (imageUrl: string, detectedObjects: any[]) => void;
  private getBodyRef: () => Record<string, any>;

  constructor(options: any) {
    const originalFetch = options.fetch || fetch;
    const onImageGenerated = options.onImageGenerated;
    const getBodyRef = options.getBody;
    
    super({
      ...options,
      // CRITICAL: Override fetch to inject body dynamically at request time
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        // Build body from ref at request time (not construction time)
        const dynamicBody = getBodyRef();
        
        // Parse existing body if present, merge with dynamic body
        let requestBody: any = {};
        if (init?.body) {
          try {
            requestBody = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          } catch {
            requestBody = {};
          }
        }
        
        // Merge dynamic body (overwrites any stale values)
        const mergedBody = {
          ...requestBody,
          ...dynamicBody,
        };
        
        // Create new request with merged body
        const newInit: RequestInit = {
          ...init,
          body: JSON.stringify(mergedBody),
          headers: {
            ...init?.headers,
            'Content-Type': 'application/json',
          },
        };
        
        console.log('[TRANSPORT] Injected dynamic body:', dynamicBody);
        console.log('[TRANSPORT] Final request body:', mergedBody);
        
        // Use custom fetch to intercept headers
        const response = await originalFetch(input, newInit);
        
        // Read headers immediately (before stream is consumed)
        const imageUrl = response.headers.get('X-Generated-Image-Url');
        const detectedObjectsStr = response.headers.get('X-Generated-Image-Objects');
        
        if (imageUrl && onImageGenerated) {
          try {
            const detectedObjects = detectedObjectsStr ? JSON.parse(detectedObjectsStr) : [];
            onImageGenerated(imageUrl, detectedObjects);
          } catch (error) {
            onImageGenerated(imageUrl, []);
          }
        }
        
        return response;
      },
    });
    this.onImageGenerated = onImageGenerated;
    this.getBodyRef = getBodyRef;
  }
}

export function useChat({ projectId, roomKey, selectedObjectId, currentImageId, initialMessages, onError, onImageGenerated }: UseChatOptions) {
  // CRITICAL: Store latest values in ref to avoid stale closure
  // This ref is updated whenever props change, and used to build body at request time
  const requestBodyRef = useRef({
    projectId,
    roomKey,
    selectedObjectId,
    currentImageId,
  });

  // CRITICAL: Update ref whenever props change (this happens synchronously)
  useEffect(() => {
    requestBodyRef.current = {
      projectId,
      roomKey,
      selectedObjectId,
      currentImageId,
    };
    console.log('🔥🔥🔥 REQUEST BODY REF UPDATED 🔥🔥🔥', {
      projectId: requestBodyRef.current.projectId,
      roomKey: requestBodyRef.current.roomKey,
      currentImageId: requestBodyRef.current.currentImageId,
      selectedObjectId: requestBodyRef.current.selectedObjectId,
      timestamp: new Date().toISOString(),
    });
  }, [projectId, roomKey, selectedObjectId, currentImageId]);

  // CRITICAL: Build body at request time using latest ref values
  // This ensures we always send the current roomKey and currentImageId
  const getBody = () => {
    const body = {
      projectId: requestBodyRef.current.projectId,
      roomKey: requestBodyRef.current.roomKey,
      selectedObjectId: requestBodyRef.current.selectedObjectId,
      currentImageId: requestBodyRef.current.currentImageId,
    };
    console.log('🔥🔥🔥 BUILDING REQUEST BODY AT SEND TIME 🔥🔥🔥', body);
    return body;
  };
  
  const chat = useAIChat({
    transport: new ImageAwareChatTransport({
      api: '/api/chat',
      getBody, // CRITICAL: Pass function, not static object
      onImageGenerated,
    }),
    initialMessages: initialMessages || [],
    onError: (error: Error) => {
      console.error('Chat error:', error);
      onError?.(error);
    },
  } as any);

  return {
    messages: chat.messages,
    isLoading: chat.status === 'streaming' || chat.status === 'submitted',
    error: chat.error,
    sendMessage: (content: string) => {
      // Log the body that will be sent
      const body = getBody();
      console.log('🔥🔥🔥 SENDING MESSAGE WITH BODY 🔥🔥🔥', body);
      console.trace('Send message stack trace');
      chat.sendMessage({ text: content });
    },
    regenerate: chat.regenerate,
    stop: chat.stop,
  };
}

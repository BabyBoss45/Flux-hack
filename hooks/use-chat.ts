'use client';

import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

interface UseChatOptions {
  projectId: number;
  roomId?: number | null;
  onError?: (error: Error) => void;
}

export function useChat({ projectId, roomId, onError }: UseChatOptions) {
  const chat = useAIChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        projectId,
        roomId,
      },
    }),
    onError: (error) => {
      console.error('Chat error:', error);
      onError?.(error);
    },
  });

  return {
    messages: chat.messages,
    isLoading: chat.status === 'streaming' || chat.status === 'submitted',
    error: chat.error,
    sendMessage: (content: string) => {
      chat.sendMessage({ text: content });
    },
    regenerate: chat.regenerate,
    stop: chat.stop,
  };
}

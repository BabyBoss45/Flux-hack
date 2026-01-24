'use client';

import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';

interface UseChatOptions {
  projectId: number;
  roomId?: number | null;
  initialMessages?: UIMessage[];
  onError?: (error: Error) => void;
}

export function useChat({ projectId, roomId, initialMessages, onError }: UseChatOptions) {
  console.log('useChat initialized with:', { projectId, roomId, initialMessagesCount: initialMessages?.length });

  const chat = useAIChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        projectId,
        roomId,
      },
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
      console.log('Sending message:', content.substring(0, 50));
      chat.sendMessage({ text: content });
    },
    regenerate: chat.regenerate,
    stop: chat.stop,
  };
}

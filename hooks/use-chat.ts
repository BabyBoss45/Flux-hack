'use client';

import { useState, useEffect } from 'react';
import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { logger } from '@/lib/logger';

interface UseChatOptions {
  projectId: number;
  roomId?: number | null;
  onError?: (error: Error) => void;
}

interface DbMessage {
  id: string;
  role: string;
  content: string;
  toolCalls: string;
  createdAt: string;
}

function transformToUIMessages(dbMessages: DbMessage[]): UIMessage[] {
  return dbMessages.map((msg) => {
    const uiMessage: UIMessage = {
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
    };

    return uiMessage;
  });
}

export function useChat({ projectId, roomId, onError }: UseChatOptions) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Load historical messages on mount or when projectId/roomId changes
  useEffect(() => {
    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        logger.debug('use-chat', 'Loading message history', { projectId, roomId });

        const params = new URLSearchParams({ projectId: projectId.toString() });
        if (roomId) {
          params.append('roomId', roomId.toString());
        }

        const res = await fetch(`/api/messages?${params}`);
        if (res.ok) {
          const data = await res.json();
          const transformed = transformToUIMessages(data.messages);
          setInitialMessages(transformed);
          logger.info('use-chat', 'Message history loaded', {
            projectId,
            roomId,
            count: transformed.length,
          });
        } else {
          logger.warn('use-chat', 'Failed to load message history', {
            status: res.status,
            projectId,
            roomId,
          });
        }
      } catch (error) {
        logger.error('use-chat', 'Exception loading message history', { error, projectId, roomId });
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, [projectId, roomId]);

  const chat = useAIChat({
    ...(initialMessages.length > 0 && { initialMessages }),
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        projectId,
        roomId,
      },
    }),
    onError: (error) => {
      logger.error('use-chat', 'Chat error', { error });
      onError?.(error);
    },
  });

  return {
    messages: chat.messages,
    isLoading: chat.status === 'streaming' || chat.status === 'submitted',
    isLoadingHistory,
    error: chat.error,
    sendMessage: (content: string) => {
      chat.sendMessage({ text: content });
    },
    regenerate: chat.regenerate,
    stop: chat.stop,
  };
}

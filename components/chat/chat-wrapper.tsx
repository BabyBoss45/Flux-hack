'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from './chat-panel';
import { useChat } from '@/hooks/use-chat';
import { type UIMessage } from 'ai';

interface ChatWrapperProps {
  projectId: number;
  roomId: number | null;
  placeholder?: string;
  onEditImage?: (imageId: number) => void;
}

function ChatInstance({
  projectId,
  roomId,
  initialMessages,
  placeholder,
  onEditImage,
}: {
  projectId: number;
  roomId: number | null;
  initialMessages: UIMessage[];
  placeholder?: string;
  onEditImage?: (imageId: number) => void;
}) {
  const { messages, isLoading: chatLoading, sendMessage, stop } = useChat({
    projectId,
    roomId,
    initialMessages,
  });

  // Cancel any in-progress stream when component unmounts
  useEffect(() => {
    return () => {
      if (chatLoading) {
        stop();
      }
    };
  }, [chatLoading, stop]);

  return (
    <ChatPanel
      messages={messages}
      isLoading={chatLoading}
      onSend={sendMessage}
      onEditImage={onEditImage}
      placeholder={placeholder}
    />
  );
}

export function ChatWrapper({ projectId, roomId, placeholder, onEditImage }: ChatWrapperProps) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [chatKey, setChatKey] = useState(0);

  // Fetch messages when room changes
  useEffect(() => {
    async function fetchMessages() {
      setIsLoadingMessages(true);
      try {
        const url = roomId
          ? `/api/projects/${projectId}/messages?roomId=${roomId}`
          : `/api/projects/${projectId}/messages`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setInitialMessages(data.messages || []);
        } else {
          setInitialMessages([]);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        setInitialMessages([]);
      } finally {
        setIsLoadingMessages(false);
        // Force chat to re-initialize with new messages
        setChatKey((prev) => prev + 1);
      }
    }

    fetchMessages();
  }, [projectId, roomId]);

  // Show loading state while fetching initial messages
  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-accent-warm border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ChatInstance
      key={chatKey}
      projectId={projectId}
      roomId={roomId}
      initialMessages={initialMessages}
      placeholder={placeholder}
      onEditImage={onEditImage}
    />
  );
}

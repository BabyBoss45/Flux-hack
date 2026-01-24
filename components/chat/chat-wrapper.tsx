'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from './chat-panel';
import { useChat } from '@/hooks/use-chat';
import { type UIMessage } from 'ai';

interface ChatWrapperProps {
  projectId: number;
  roomId: number; // CRITICAL: roomId is required, not nullable - must be provided from UI state
  selectedObjectId?: string | null;
  selectedObjectLabel?: string | null; // Object label for tag display (e.g., "armchair")
  selectedRoomId: number; // CRITICAL: Room ID is required - single source of truth from UI state
  currentImageId: number | null; // CRITICAL: Current image ID from UI state - explicit source of truth
  placeholder?: string;
  onEditImage?: (imageId: number) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onImageGenerated?: (imageUrl: string, detectedObjects: any[]) => void;
}

// CRITICAL: Chat should be disabled if no image is visible
// The visible image is the single source of truth
function shouldDisableChat(currentImageId: number | null, roomImages: any[]): boolean {
  // If there are images but no currentImageId, chat is disabled
  if (roomImages.length > 0 && !currentImageId) {
    return true;
  }
  // If no images at all, allow chat (for first generation)
  return false;
}

function ChatInstance({
  projectId,
  roomKey,
  selectedObjectId,
  selectedObjectLabel,
  selectedRoomTag,
  currentImageId, // CRITICAL: Explicit currentImageId from UI state - never inferred
  initialMessages,
  placeholder,
  onEditImage,
  onLoadingChange,
  onImageGenerated,
}: {
  projectId: number;
  roomKey: string; // Required - client-side stable key
  selectedObjectId?: string | null;
  selectedObjectLabel?: string | null;
  selectedRoomTag: string | null; // DEPRECATED: Not used anymore
  currentImageId: number | null; // CRITICAL: Explicit currentImageId from UI state - never inferred
  initialMessages: UIMessage[];
  placeholder?: string;
  onEditImage?: (imageId: number) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onImageGenerated?: (imageUrl: string, detectedObjects: any[]) => void;
}) {
  // CRITICAL: Log props to verify roomKey is being passed correctly
  useEffect(() => {
    console.log('[CHAT INSTANCE] Props received:', {
      roomKey,
      selectedRoomTag,
      currentImageId,
    });
  }, [roomKey, selectedRoomTag, currentImageId]);

  // CRITICAL: roomKey comes from UI state - never guess, never infer
  // This ensures chat always knows which room the user is editing
  console.log('[CHAT INSTANCE] Calling useChat with roomKey:', roomKey);
  const { messages, isLoading: chatLoading, sendMessage, stop } = useChat({
    projectId,
    roomKey, // Explicitly passed from UI state
    selectedObjectId,
    currentImageId,
    initialMessages,
    onImageGenerated,
  });

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(chatLoading);
  }, [chatLoading, onLoadingChange]);

  // Cancel any in-progress stream when component unmounts
  useEffect(() => {
    return () => {
      if (chatLoading) {
        stop();
      }
    };
  }, [chatLoading, stop]);

  // CRITICAL: Room tag is computed in ChatWrapper and passed down as selectedRoomTag
  // Do NOT compute it here - use the prop from parent
  return (
    <ChatPanel
      messages={messages}
      isLoading={chatLoading}
      onSend={sendMessage}
      onEditImage={onEditImage}
      placeholder={placeholder}
      selectedObjectTag={selectedObjectLabel || null}
      selectedRoomTag={selectedRoomTag}
      currentImageId={currentImageId}
    />
  );
}

export function ChatWrapper({ projectId, roomKey, selectedObjectId, selectedObjectLabel, currentImageId, placeholder, onEditImage, onLoadingChange, onImageGenerated }: ChatWrapperProps) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [chatKey, setChatKey] = useState(0);

  // REMOVED: Room tag is no longer used - room selection is handled via roomKey prop only
  const roomTag = null;

  // Fetch messages when room changes (still use roomKey in query for filtering if needed)
  useEffect(() => {
    async function fetchMessages() {
      setIsLoadingMessages(true);
      try {
        // For now, fetch all messages for project (can filter by roomKey later if needed)
        const url = `/api/projects/${projectId}/messages`;
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
  }, [projectId, roomKey]);

  // Debug: Log when room changes
  useEffect(() => {
    console.log('[CHAT WRAPPER] Room key changed:', {
      roomKey,
      timestamp: new Date().toISOString(),
    });
  }, [roomKey]);

  // Show loading state while fetching initial messages
  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-accent-warm border-t-transparent rounded-full" />
      </div>
    );
  }

  console.log('🔥🔥🔥 CHAT WRAPPER RENDERING 🔥🔥🔥', {
    roomKey,
    currentImageId,
    hasMessages: initialMessages.length > 0,
    timestamp: new Date().toISOString(),
  });

  return (
    <ChatInstance
      key={chatKey}
      projectId={projectId}
      roomKey={roomKey}
      selectedObjectId={selectedObjectId}
      selectedObjectLabel={selectedObjectLabel}
      selectedRoomTag={roomTag}
      currentImageId={currentImageId}
      initialMessages={initialMessages}
      placeholder={placeholder}
      onEditImage={onEditImage}
      onLoadingChange={onLoadingChange}
      onImageGenerated={onImageGenerated}
    />
  );
}

'use client';

import { useRef, useEffect, useState } from 'react';
import { Bot, Loader2, Send } from 'lucide-react';
import type { UIMessage } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatImage } from './chat-image';

interface ChatPanelProps {
  messages: UIMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
  onEditImage?: (imageId: number) => void;
  placeholder?: string;
  disabled?: boolean;
  selectedObjectTag?: string | null; // Tag to append to input (e.g., "@armchair") - only ONE tag at a time
  selectedRoomTag?: string | null; // DEPRECATED: Room tags removed - room selection handled via roomId prop
  currentImageId?: number | null; // CRITICAL: If null, chat is disabled (no visible image)
}

export function ChatPanel({
  messages,
  isLoading,
  onSend,
  onEditImage,
  placeholder = 'Describe your design vision...',
  disabled = false,
  selectedObjectTag,
  selectedRoomTag,
  currentImageId,
}: ChatPanelProps) {
  // CRITICAL: Disable chat if no image is visible (except for first generation)
  // If images exist but currentImageId is null, disable chat
  const isChatDisabled = disabled || (currentImageId === null && messages.length > 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const previousObjectTagRef = useRef<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Append object tag to input when object is selected (like Cursor's @tag feature)
  // CRITICAL: Only ONE object tag at a time - replace previous tag when new one is selected
  useEffect(() => {
    setInput((currentInput) => {
      if (selectedObjectTag) {
        const tagText = `@${selectedObjectTag} `;
        
        // If tag changed, replace the old tag with the new one
        if (selectedObjectTag !== previousObjectTagRef.current) {
          let newInput = currentInput;
          
          // Remove previous object tag if it exists (any @object pattern)
          if (previousObjectTagRef.current) {
            const oldTag = `@${previousObjectTagRef.current} `;
            // Remove from anywhere in the string
            newInput = newInput.replace(new RegExp(`@${previousObjectTagRef.current}\\s+`, 'g'), '');
          }
          
          // Also remove any existing @object pattern (safety net)
          newInput = newInput.replace(/@\w+\s+/g, '');
          
          // Add new object tag at the start
          newInput = newInput.trim() ? `${tagText}${newInput.trim()}` : tagText;
          
          previousObjectTagRef.current = selectedObjectTag;
          
          // Focus the textarea
          setTimeout(() => {
            textareaRef.current?.focus();
            if (textareaRef.current) {
              const length = newInput.length;
              textareaRef.current.setSelectionRange(length, length);
            }
          }, 0);
          
          return newInput;
        }
        
        // Tag unchanged, but ensure it's at the start
        if (!currentInput.startsWith(tagText)) {
          let newInput = currentInput;
          // Remove any existing @object pattern
          newInput = newInput.replace(/@\w+\s+/g, '');
          // Add tag at start
          newInput = newInput.trim() ? `${tagText}${newInput.trim()}` : tagText;
          return newInput;
        }
        
        return currentInput;
      } else if (!selectedObjectTag && previousObjectTagRef.current) {
        // Object tag was deselected - remove it from input
        const tagToRemove = `@${previousObjectTagRef.current} `;
        let newInput = currentInput;
        // Remove the tag from anywhere
        newInput = newInput.replace(new RegExp(`@${previousObjectTagRef.current}\\s+`, 'g'), '');
        previousObjectTagRef.current = null;
        return newInput;
      }
      
      return currentInput;
    });
  }, [selectedObjectTag]); // Only depend on selectedObjectTag to avoid loops

  // REMOVED: Room tag functionality - room selection is handled via roomId prop only
  // No room tags are added to the input anymore

  // Extract text content from a message
  const getMessageText = (message: UIMessage): string => {
    const msg = message as any;

    // Debug log
    if (msg.role === 'assistant') {
      console.log('Assistant message:', {
        id: msg.id,
        contentType: typeof msg.content,
        content: msg.content,
        parts: msg.parts,
      });
    }

    // Handle string content
    if (typeof msg.content === 'string') {
      return msg.content;
    }

    // Handle parts array (from streaming)
    if (msg.parts && Array.isArray(msg.parts)) {
      return msg.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }

    // Handle content array
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }

    return '';
  };

  // Get tool invocations from message
  const getToolInvocations = (message: UIMessage) => {
    return (message as any).toolInvocations || [];
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    // CRITICAL: Never allow sending if currentImageId is null (unless it's first message)
    if (trimmed && !isLoading && !isChatDisabled) {
      // Double-check currentImageId before sending
      if (currentImageId === null && messages.length > 0) {
        console.error('[CHAT PANEL] Blocked send: currentImageId is null but messages exist');
        return;
      }
      
      // CRITICAL: Append image ID to message so AI knows which image is being edited
      let messageToSend = trimmed;
      if (currentImageId) {
        messageToSend = `[Image ID: ${currentImageId}] ${trimmed}`;
        console.log('[CHAT PANEL] Appending image ID to message:', { currentImageId, original: trimmed, final: messageToSend });
      }
      
      onSend(messageToSend);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="panel h-full flex flex-col max-h-[calc(100vh-120px)]">
      <div className="panel-header">
        <h2 className="text-lg font-semibold text-white">Design Assistant</h2>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="text-center text-white/50 py-8">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start a conversation to design your space</p>
          </div>
        ) : (
          messages.map((message) => {
            const text = getMessageText(message);
            const toolInvocations = getToolInvocations(message);

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                <div
                  className={`flex-1 max-w-[85%] ${
                    message.role === 'user' ? 'flex flex-col items-end' : ''
                  }`}
                >
                  {text && (
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        message.role === 'user'
                          ? 'bg-accent-warm text-white'
                          : 'bg-white/5 text-white/90'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{text}</p>
                    </div>
                  )}

                  {/* Render tool invocations */}
                  {toolInvocations.map((invocation: any, index: any) => {
                    // Show result if available
                    if (
                      invocation.state === 'result' &&
                      invocation.result?.success &&
                      invocation.result?.imageUrl
                    ) {
                      return (
                        <ChatImage
                          key={invocation.toolCallId || index}
                          imageUrl={invocation.result.imageUrl as string}
                          imageId={invocation.result.imageId as number}
                          message={invocation.result.message as string}
                          onEdit={onEditImage}
                        />
                      );
                    }

                    // Show loading state for pending/in-progress tools
                    if (invocation.state === 'call' || invocation.state === 'partial-call') {
                      return (
                        <div
                          key={invocation.toolCallId || index}
                          className="mt-2 flex items-center gap-2 text-xs text-white/50"
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>
                            {invocation.toolName === 'generate_room_image'
                              ? 'Generating image...'
                              : invocation.toolName === 'edit_room_image'
                              ? 'Editing image...'
                              : invocation.toolName === 'scan_image_items'
                              ? 'Scanning items...'
                              : invocation.toolName === 'approve_room'
                              ? 'Approving room...'
                              : 'Processing...'}
                          </span>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })
        )}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentImageId === null && messages.length > 0 ? 'Please select an image to continue...' : placeholder}
            disabled={isLoading || isChatDisabled}
            className="min-h-[44px] max-h-[150px] resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40 flex-1"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || isChatDisabled}
            size="icon"
            className="h-11 w-11 flex-shrink-0 bg-accent-warm hover:bg-accent-warm/90"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-white/40 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

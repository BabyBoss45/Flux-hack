'use client';

import { useRef, useEffect } from 'react';
import { User, Bot, Loader2 } from 'lucide-react';
import type { UIMessage } from 'ai';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatImage } from './chat-image';

interface ChatInterfaceProps {
  messages: UIMessage[];
  isLoading: boolean;
  onEditImage?: (imageId: number) => void;
}

export function ChatInterface({ messages, isLoading, onEditImage }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Extract text content from a message
  const getMessageText = (message: UIMessage): string => {
    if (!message.parts) return '';

    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('');
  };

  // Check if message has tool parts (tool types start with 'tool-')
  const getToolParts = (message: UIMessage) => {
    if (!message.parts) return [];
    return message.parts.filter((part) => part.type.startsWith('tool-'));
  };

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-4 max-w-3xl mx-auto">
        {messages.map((message) => {
          const text = getMessageText(message);
          const toolParts = getToolParts(message);

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}

              <div
                className={`flex-1 max-w-[80%] ${
                  message.role === 'user' ? 'flex flex-col items-end' : ''
                }`}
              >
                {text && (
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{text}</p>
                  </div>
                )}

                {/* Render tool results (e.g., generated images) */}
                {toolParts.map((part: unknown, index) => {
                  const toolPart = part as {
                    type: 'tool';
                    toolInvocation: {
                      toolName: string;
                      toolCallId: string;
                      state: string;
                      result?: Record<string, unknown>;
                    }
                  };
                  const invocation = toolPart.toolInvocation;

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

                  if (invocation.state === 'call' || invocation.state === 'partial-call') {
                    return (
                      <div
                        key={invocation.toolCallId || index}
                        className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
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

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

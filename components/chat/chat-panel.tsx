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
}

export function ChatPanel({
  messages,
  isLoading,
  onSend,
  onEditImage,
  placeholder = 'Describe your design vision...',
  disabled = false,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');

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

  // Extract text content from a message
  const getMessageText = (message: UIMessage): string => {
    if (!message.parts) return '';

    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('');
  };

  // Check if message has tool parts
  const getToolParts = (message: UIMessage) => {
    if (!message.parts) return [];
    return message.parts.filter((part) => part.type.startsWith('tool-'));
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed && !isLoading && !disabled) {
      onSend(trimmed);
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
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <h2 className="text-lg font-semibold text-white">Design Assistant</h2>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="text-center text-white/50 py-8">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start a conversation to design your space</p>
          </div>
        ) : (
          messages.map((message) => {
            const text = getMessageText(message);
            const toolParts = getToolParts(message);

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

                  {/* Render tool results */}
                  {toolParts.map((part: unknown, index) => {
                    const toolPart = part as {
                      type: 'tool';
                      toolInvocation: {
                        toolName: string;
                        toolCallId: string;
                        state: string;
                        result?: Record<string, unknown>;
                      };
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
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className="min-h-[44px] max-h-[150px] resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40 flex-1"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || disabled}
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

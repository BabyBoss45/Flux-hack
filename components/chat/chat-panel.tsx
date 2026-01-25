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
    <div className="panel h-full flex flex-col max-h-[calc(100vh-120px)]">
      <div className="panel-header flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_8px_rgba(0,255,157,0.6)]" />
        <h2 className="text-lg font-semibold text-white">Design Assistant</h2>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="text-center text-white/40 py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.2)] flex items-center justify-center">
              <Bot className="w-6 h-6 text-[#00ff9d]" />
            </div>
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
                  <div className="w-7 h-7 rounded-lg bg-[rgba(0,255,157,0.15)] border border-[rgba(0,255,157,0.3)] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-[#00ff9d]" />
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
                          ? 'bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] text-[#030508]'
                          : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-white/90'
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
                          className="mt-2 flex items-center gap-2 text-xs text-[#00ff9d]/70"
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
            <div className="w-7 h-7 rounded-lg bg-[rgba(0,255,157,0.15)] border border-[rgba(0,255,157,0.3)] flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-[#00ff9d]" />
            </div>
            <div className="flex items-center gap-2 text-[#00ff9d]/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-[rgba(0,255,157,0.1)] p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className="min-h-[44px] max-h-[150px] resize-none flex-1"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || disabled}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-white/30 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

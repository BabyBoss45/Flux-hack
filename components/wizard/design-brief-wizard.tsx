'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, ArrowRight, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  WizardOptionButton,
  WizardOptionsGrid,
  WizardOptionsPills,
} from './wizard-option-button';
import type {
  WizardStep,
  WizardState,
  BuildingType,
  ArchitectureStyle,
  Atmosphere,
  Constraint,
  WizardSummaryData,
} from '@/lib/wizard/types';
import {
  BUILDING_TYPE_OPTIONS,
  ARCHITECTURE_STYLE_OPTIONS,
  ATMOSPHERE_OPTIONS,
  CONSTRAINT_OPTIONS,
  getOptionLabel,
} from '@/lib/wizard/types';

interface DesignBriefWizardProps {
  projectId: number;
  onComplete: (data: WizardSummaryData) => void;
  onStateChange?: (state: WizardState) => void;
  existingPreferences?: Partial<WizardState>;
  hasFloorPlan?: boolean; // Whether floor plan/rooms are uploaded
  roomCount?: number; // Number of detected rooms
}

interface ChatMessage {
  id: string;
  type: 'bot' | 'user' | 'options';
  content: string;
  options?: {
    type: 'grid' | 'pills' | 'color';
    items: { label: string; value: string; icon?: string; color?: string; description?: string }[];
    multiSelect?: boolean;
    columns?: 2 | 3 | 4;
  };
  selectedValues?: string[];
  showCustomInput?: boolean;
  animate?: boolean;
}

// Unique ID counter for messages
let messageIdCounter = 0;
const generateMessageId = () => `msg-${Date.now()}-${++messageIdCounter}-${Math.random().toString(36).slice(2, 7)}`;

export function DesignBriefWizard({
  projectId,
  onComplete,
  onStateChange,
  existingPreferences,
  hasFloorPlan = false,
  roomCount = 0,
}: DesignBriefWizardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomField, setShowCustomField] = useState(false);

  // Wizard state
  const [state, setState] = useState<WizardState>({
    currentStep: 'intro',
    constraints: [],
    ...existingPreferences,
  });

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Save to API incrementally
  const saveToProject = useCallback(async (updates: Record<string, unknown>) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Failed to save wizard progress:', error);
    }
  }, [projectId]);

  // Add message with typing animation
  const addBotMessage = useCallback(async (content: string, options?: ChatMessage['options'], showCustomInput?: boolean) => {
    const id = generateMessageId();
    setIsTyping(true);

    // Simulate typing delay
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));

    setMessages((prev) => [
      ...prev,
      {
        id,
        type: 'bot',
        content,
        options,
        showCustomInput,
        animate: true,
      },
    ]);
    setIsTyping(false);
    
    // Show custom input field if needed
    if (showCustomInput) {
      setShowCustomField(true);
    }
    
    return id;
  }, []);

  const addUserMessage = useCallback((content: string, selectedValues?: string[]) => {
    const id = generateMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id,
        type: 'user',
        content,
        selectedValues,
      },
    ]);
    setShowCustomField(false);
    setCustomInput('');
    return id;
  }, []);

  // Initialize wizard (only once)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    addBotMessage("Let's design your space ✨\n\nI'll ask a few quick questions — just tap your choice.", {
      type: 'grid',
      items: [{ label: 'Start', value: 'start', icon: '🚀' }],
      columns: 2,
    });
  }, [addBotMessage]);

  // Handle option selection
  const handleSelect = useCallback(async (value: string, label: string) => {
    const { currentStep } = state;

    // Add user response
    addUserMessage(label);

    // Process based on current step
    switch (currentStep) {
      case 'intro':
        setState((prev) => ({ ...prev, currentStep: 'building-type' }));
        await addBotMessage('What are you designing?', {
          type: 'grid',
          items: BUILDING_TYPE_OPTIONS,
          columns: 3,
        });
        break;

      case 'building-type':
        setState((prev) => ({ ...prev, buildingType: value as BuildingType, currentStep: 'architecture-style' }));
        // Save immediately
        await saveToProject({ building_type: value });
        await addBotMessage('What architectural style best matches the space?', {
          type: 'grid',
          items: ARCHITECTURE_STYLE_OPTIONS,
          columns: 4,
        });
        break;

      case 'architecture-style':
        setState((prev) => ({ ...prev, architectureStyle: value as ArchitectureStyle, currentStep: 'atmosphere' }));
        // Save immediately
        await saveToProject({ architecture_style: value });
        await addBotMessage('How should the space feel?', {
          type: 'grid',
          items: ATMOSPHERE_OPTIONS,
          columns: 3,
        });
        break;

      case 'atmosphere':
        setState((prev) => ({ ...prev, atmosphere: value as Atmosphere, currentStep: 'constraints' }));
        // Save immediately
        await saveToProject({ atmosphere: value });
        await addBotMessage('Anything important we should consider?\n\nSelect all that apply, then tap Continue.', {
          type: 'pills',
          items: CONSTRAINT_OPTIONS,
          multiSelect: true,
        }, true);
        break;

      default:
        break;
    }
  }, [state, addUserMessage, addBotMessage, saveToProject]);

  // Handle multi-select toggle
  const handleMultiSelectToggle = useCallback((value: string, currentMessageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === currentMessageId) {
          const currentSelections = msg.selectedValues || [];
          const newSelections = currentSelections.includes(value)
            ? currentSelections.filter((v) => v !== value)
            : [...currentSelections, value];
          return { ...msg, selectedValues: newSelections };
        }
        return msg;
      })
    );
  }, []);

  // Confirm multi-select (constraints step)
  const confirmMultiSelect = useCallback(async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const selectedValues = message.selectedValues || [];
    const selectedLabels = selectedValues
      .map((v) => message.options?.items.find((i) => i.value === v)?.label || v)
      .join(', ');

    // Add custom input if provided
    const finalLabels = customInput.trim()
      ? `${selectedLabels}${selectedLabels ? ', ' : ''}${customInput.trim()}`
      : selectedLabels || 'None selected';

    addUserMessage(finalLabels, selectedValues);

    const customNotes = customInput.trim() || undefined;
    
    // Update state
    setState((prev) => ({
      ...prev,
      constraints: selectedValues as Constraint[],
      customNotes,
      currentStep: 'complete',
    }));

    // Save global preferences as JSON
    const globalPreferences = {
      constraints: selectedValues,
      custom_notes: customNotes,
      wizardCompleted: true,
    };
    await saveToProject({ global_preferences: JSON.stringify(globalPreferences) });

    setCustomInput('');
    setShowCustomField(false);

    // Show completion message - different based on floor plan status
    if (hasFloorPlan && roomCount > 0) {
      await addBotMessage(`Perfect! Here's your design brief:\n\n✓ ${roomCount} room${roomCount !== 1 ? 's' : ''} detected from floor plan\n✓ Ready to generate designs`, {
        type: 'grid',
        items: [{ label: 'Generate Designs', value: 'approve', icon: '✨' }],
        columns: 2,
      });
    } else {
      await addBotMessage("Almost done! Upload a floor plan first to generate room designs.\n\n⚠️ Floor plan required", {
        type: 'grid',
        items: [{ label: 'Waiting for floor plan...', value: 'waiting', icon: '📋' }],
        columns: 2,
      });
    }
  }, [messages, customInput, addUserMessage, addBotMessage, saveToProject, hasFloorPlan, roomCount]);

  // Handle approve action - validates all inputs before proceeding
  const handleApprove = useCallback(() => {
    // Validate required inputs
    const validationErrors: string[] = [];
    
    if (!hasFloorPlan || roomCount === 0) {
      validationErrors.push('Floor plan with rooms is required');
    }
    if (!state.buildingType) {
      validationErrors.push('Building type is required');
    }
    if (!state.architectureStyle) {
      validationErrors.push('Architecture style is required');
    }
    if (!state.atmosphere) {
      validationErrors.push('Atmosphere is required');
    }
    
    if (validationErrors.length > 0) {
      // Don't proceed - show error (this shouldn't happen if UI is correct)
      console.error('Validation errors:', validationErrors);
      return;
    }
    
    const summaryData: WizardSummaryData = {
      buildingType: state.buildingType 
        ? getOptionLabel(BUILDING_TYPE_OPTIONS, state.buildingType)
        : undefined,
      architectureStyle: state.architectureStyle
        ? getOptionLabel(ARCHITECTURE_STYLE_OPTIONS, state.architectureStyle)
        : undefined,
      atmosphere: state.atmosphere
        ? getOptionLabel(ATMOSPHERE_OPTIONS, state.atmosphere)
        : undefined,
      constraints: state.constraints.map(
        (c) => getOptionLabel(CONSTRAINT_OPTIONS, c)
      ),
      customNotes: state.customNotes,
    };

    onComplete(summaryData);
  }, [state, onComplete, hasFloorPlan, roomCount]);

  // Handle custom input submission
  const handleCustomSubmit = useCallback(async () => {
    const { currentStep } = state;
    
    if (currentStep === 'constraints' || currentStep === 'constraints-custom') {
      // Find the last message with multiSelect
      const lastMultiSelectMsg = [...messages].reverse().find((m) => m.options?.multiSelect);
      if (lastMultiSelectMsg) {
        confirmMultiSelect(lastMultiSelectMsg.id);
      }
    }
  }, [messages, confirmMultiSelect, state]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-2 flex-shrink-0 border-b border-white/[0.06]">
        <Sparkles className="w-5 h-5 text-accent-warm" />
        <h2 className="text-base font-semibold text-white">Design Brief</h2>
      </div>

      {/* Messages area - scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
              message.type === 'user' ? 'flex justify-end' : ''
            )}
          >
            {message.type === 'bot' && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 max-w-[90%] space-y-3">
                  <div className="bg-white/5 rounded-lg px-3 py-2">
                    <p className="text-sm text-white/90 whitespace-pre-wrap">{message.content}</p>
                  </div>
                  
                  {/* Render options */}
                  {message.options && (
                    <div className="mt-3">
                      {message.options.type === 'grid' && (
                        <WizardOptionsGrid columns={message.options.columns || 3}>
                          {message.options.items.map((item) => (
                            <WizardOptionButton
                              key={item.value}
                              option={item}
                              variant="card"
                              selected={
                                message.options?.multiSelect
                                  ? message.selectedValues?.includes(item.value)
                                  : false
                              }
                              onSelect={(v) => {
                                if (message.options?.multiSelect) {
                                  handleMultiSelectToggle(v, message.id);
                                } else if (v === 'approve') {
                                  handleApprove();
                                } else if (v === 'waiting') {
                                  // Do nothing - waiting for floor plan
                                } else {
                                  handleSelect(v, item.label);
                                }
                              }}
                            />
                          ))}
                        </WizardOptionsGrid>
                      )}
                      
                      {message.options.type === 'pills' && (
                        <WizardOptionsPills>
                          {message.options.items.map((item) => (
                            <WizardOptionButton
                              key={item.value}
                              option={item}
                              variant="compact"
                              selected={
                                message.options?.multiSelect
                                  ? message.selectedValues?.includes(item.value)
                                  : false
                              }
                              onSelect={(v) => {
                                if (message.options?.multiSelect) {
                                  handleMultiSelectToggle(v, message.id);
                                } else {
                                  handleSelect(v, item.label);
                                }
                              }}
                            />
                          ))}
                        </WizardOptionsPills>
                      )}
                      
                      {message.options.type === 'color' && (
                        <WizardOptionsGrid columns={message.options.columns || 3}>
                          {message.options.items.map((item) => (
                            <WizardOptionButton
                              key={item.value}
                              option={item}
                              variant={item.color ? 'color' : 'card'}
                              selected={false}
                              onSelect={(v) => handleSelect(v, item.label)}
                            />
                          ))}
                        </WizardOptionsGrid>
                      )}
                      
                      {/* Continue button for multi-select */}
                      {message.options.multiSelect && (
                        <div className="mt-4 flex items-center gap-2">
                          <Button
                            onClick={() => confirmMultiSelect(message.id)}
                            className="bg-accent-warm hover:bg-accent-warm/90 text-black"
                          >
                            Continue
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {message.type === 'user' && (
              <div className="bg-accent-warm text-black rounded-lg px-3 py-2 max-w-[80%]">
                <p className="text-sm font-medium">{message.content}</p>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white/5 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom input area (only shown for constraints step) */}
      {showCustomField && (
        <div className="border-t border-white/10 p-3 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCustomSubmit();
                  }
                }}
                placeholder="Add custom requirement (optional)..."
                className="min-h-[44px] max-h-[100px] resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40"
                rows={1}
              />
            </div>
          </div>
          <p className="text-xs text-white/40 mt-2 text-center">
            Select options above, then press Continue
          </p>
        </div>
      )}
    </div>
  );
}

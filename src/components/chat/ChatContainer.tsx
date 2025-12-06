'use client';

import { useEffect, useRef } from 'react';
import { QaevMessage } from '@/types/database';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { SearchStatus } from './SearchStatus';

interface ChatContainerProps {
  messages: QaevMessage[];
  isLoading?: boolean;
  onSendMessage: (message: string) => void;
  onFeedback: (messageId: string, rating: 'GOOD' | 'BAD', feedbackText?: string) => Promise<void>;
}

export function ChatContainer({
  messages,
  isLoading = false,
  onSendMessage,
  onFeedback,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="mb-2 text-lg font-medium">Welcome to QA Assistant</p>
              <p className="text-sm">Ask any question about our company knowledge base.</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onFeedback={message.role === 'assistant' ? onFeedback : undefined}
              />
            ))}
            {isLoading && <SearchStatus />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <ChatInput
          onSend={onSendMessage}
          disabled={isLoading}
          placeholder="Type your question..."
        />
      </div>
    </div>
  );
}

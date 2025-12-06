'use client';

import { useState, useCallback } from 'react';
import { QaevMessage } from '@/types/database';

interface UseChatOptions {
  sessionId: string;
  initialMessages?: QaevMessage[];
}

interface UseChatReturn {
  messages: QaevMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 'GOOD' | 'BAD', feedbackText?: string) => Promise<void>;
}

export function useChat({ sessionId, initialMessages = [] }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<QaevMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: QaevMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content,
      sources: null,
      feedback_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await fetch('/api/qa/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const data = await response.json();

      // Replace temp user message and add assistant message
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserMessage.id);
        return [
          ...withoutTemp,
          {
            ...tempUserMessage,
            id: data.message.id.replace(/assistant$/, 'user') || tempUserMessage.id,
          },
          data.message,
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading]);

  const submitFeedback = useCallback(async (
    messageId: string,
    rating: 'GOOD' | 'BAD',
    feedbackText?: string
  ) => {
    try {
      const response = await fetch('/api/qa/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          rating,
          feedbackText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      const data = await response.json();

      // Update message with feedback_id
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, feedback_id: data.feedback.id } : m
        )
      );
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      throw err;
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    submitFeedback,
  };
}

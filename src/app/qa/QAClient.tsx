'use client';

import { useEffect, useState } from 'react';
import { ChatContainer, SessionSidebar } from '@/components/chat';
import { useChat, useSessions } from '@/hooks';
import { QaevMessage } from '@/types/database';

export function QAClient() {
  const {
    sessions,
    currentSession,
    isLoading: sessionsLoading,
    createSession,
    deleteSession,
    selectSession,
  } = useSessions();

  const [messages, setMessages] = useState<QaevMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Load messages when session changes
  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const response = await fetch(`/api/qa/sessions/${currentSession.id}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [currentSession]);

  const {
    isLoading: chatLoading,
    sendMessage,
    submitFeedback,
  } = useChat({
    sessionId: currentSession?.id || '',
    initialMessages: messages,
  });

  // Sync messages from useChat
  useEffect(() => {
    if (currentSession) {
      // Re-fetch messages after sending
    }
  }, [chatLoading, currentSession]);

  const handleSendMessage = async (content: string) => {
    if (!currentSession) {
      // Create new session first
      const newSession = await createSession();
      if (!newSession) return;
    }

    setSendingMessage(true);

    // Optimistic update
    const tempMessage: QaevMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSession?.id || '',
      role: 'user',
      content,
      sources: null,
      feedback_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const response = await fetch('/api/qa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          sessionId: currentSession?.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.id.startsWith('temp-'));
          return [...filtered, { ...tempMessage, id: data.message.id.replace(/assistant$/, '') }, data.message];
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFeedback = async (
    messageId: string,
    rating: 'GOOD' | 'BAD',
    feedbackText?: string
  ) => {
    await submitFeedback(messageId, rating, feedbackText);
    // Update local state
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback_id: 'submitted' } : m
      )
    );
  };

  const handleCreateSession = async () => {
    await createSession();
  };

  const handleSelectSession = (sessionId: string) => {
    selectSession(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this chat?')) {
      await deleteSession(sessionId);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSession?.id || null}
        isLoading={sessionsLoading}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main chat area */}
      <div className="flex-1">
        {currentSession ? (
          <ChatContainer
            messages={messages}
            isLoading={chatLoading || messagesLoading || sendingMessage}
            onSendMessage={handleSendMessage}
            onFeedback={handleFeedback}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Welcome to QA Assistant
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Select a chat or create a new one to get started.
              </p>
              <button
                onClick={handleCreateSession}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

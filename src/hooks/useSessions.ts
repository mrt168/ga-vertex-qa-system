'use client';

import { useState, useCallback, useEffect } from 'react';
import { QaevSession } from '@/types/database';

interface UseSessionsReturn {
  sessions: QaevSession[];
  currentSession: QaevSession | null;
  isLoading: boolean;
  error: string | null;
  createSession: () => Promise<QaevSession | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  selectSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<QaevSession[]>([]);
  const [currentSession, setCurrentSession] = useState<QaevSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/qa/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      setIsLoading(true);
      await refreshSessions();
      setIsLoading(false);
    };
    loadSessions();
  }, [refreshSessions]);

  const createSession = useCallback(async (): Promise<QaevSession | null> => {
    try {
      const response = await fetch('/api/qa/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const data = await response.json();
      const newSession = data.session;

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);

      return newSession;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/qa/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete session');
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [currentSession]);

  const selectSession = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
    }
  }, [sessions]);

  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    try {
      const response = await fetch(`/api/qa/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update session');
      }

      const data = await response.json();

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? data.session : s))
      );

      if (currentSession?.id === sessionId) {
        setCurrentSession(data.session);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [currentSession]);

  return {
    sessions,
    currentSession,
    isLoading,
    error,
    createSession,
    deleteSession,
    selectSession,
    updateSessionTitle,
    refreshSessions,
  };
}

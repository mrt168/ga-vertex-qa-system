'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface EvolutionStats {
  feedback: {
    total: number;
    good: number;
    bad: number;
    pendingBad: number;
  };
  evolution: {
    eligibleDocuments: number;
    eligibleDocumentIds: string[];
    totalEvolutions: number;
    successfulEvolutions: number;
    threshold: number;
  };
  documents: {
    total: number;
  };
}

interface EvolutionHistory {
  id: string;
  document_id: string;
  generation: number;
  mutation_type: string;
  win_rate: number | null;
  created_at: string;
  document?: {
    id: string;
    file_name: string;
  };
}

interface QAPair {
  id: string;
  sessionId: string;
  sessionTitle: string | null;
  question: string;
  answer: string;
  rating: 'GOOD' | 'BAD' | null;
  feedbackText: string | null;
  createdAt: string;
}

type TabType = 'overview' | 'evolution' | 'qa-logs';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [history, setHistory] = useState<EvolutionHistory[]>([]);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [expandedQA, setExpandedQA] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/evolution/stats');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch stats');
      }
      const data = await res.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [router]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/evolution/history?limit=20');
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  const fetchQALogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (ratingFilter !== 'all') {
        params.set('rating', ratingFilter);
      }
      const res = await fetch(`/api/admin/qa-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch QA logs');
      const data = await res.json();
      setQaPairs(data.qaPairs || []);
    } catch (err) {
      console.error('Failed to fetch QA logs:', err);
    }
  }, [ratingFilter]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchHistory(), fetchQALogs()]);
      setLoading(false);
    };
    init();
  }, [fetchStats, fetchHistory, fetchQALogs]);

  useEffect(() => {
    if (!loading) {
      fetchQALogs();
    }
  }, [ratingFilter, fetchQALogs, loading]);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">QA Evolution Admin</h1>
              <p className="text-sm text-slate-400">Self-Evolving Knowledge Base</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/qa')}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to QA
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl w-fit">
          {[
            { id: 'overview' as TabType, label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            { id: 'evolution' as TabType, label: 'Evolution Timeline', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { id: 'qa-logs' as TabType, label: 'Q&A Logs', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Documents */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Documents</p>
                    <p className="text-3xl font-bold text-white">{stats?.documents.total || 0}</p>
                  </div>
                </div>
              </div>

              {/* Total Feedback */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Feedback</p>
                    <p className="text-3xl font-bold text-white">{stats?.feedback.total || 0}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-green-400 text-sm">{stats?.feedback.good || 0} Good</span>
                      <span className="text-red-400 text-sm">{stats?.feedback.bad || 0} Bad</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Issues */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Pending Bad Feedback</p>
                    <p className="text-3xl font-bold text-orange-400">{stats?.feedback.pendingBad || 0}</p>
                  </div>
                </div>
              </div>

              {/* Evolution Ready */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Ready for Evolution</p>
                    <p className="text-3xl font-bold text-cyan-400">{stats?.evolution.eligibleDocuments || 0}</p>
                    <p className="text-slate-500 text-xs mt-1">Threshold: {stats?.evolution.threshold || 3}+ bad ratings</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Evolution Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Evolution Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Total Evolutions</p>
                    <p className="text-2xl font-bold text-white">{stats?.evolution.totalEvolutions || 0}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Successful</p>
                    <p className="text-2xl font-bold text-green-400">{stats?.evolution.successfulEvolutions || 0}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-slate-400 mb-2">
                    <span>Success Rate</span>
                    <span>
                      {stats?.evolution.totalEvolutions
                        ? Math.round((stats.evolution.successfulEvolutions / stats.evolution.totalEvolutions) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          stats?.evolution.totalEvolutions
                            ? (stats.evolution.successfulEvolutions / stats.evolution.totalEvolutions) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Feedback Distribution</h3>
                <div className="flex items-center justify-center h-32">
                  <div className="relative w-32 h-32">
                    <svg className="transform -rotate-90 w-32 h-32">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="16"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="16"
                        strokeDasharray={`${
                          stats?.feedback.total
                            ? (stats.feedback.good / stats.feedback.total) * 352
                            : 0
                        } 352`}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {stats?.feedback.total
                          ? Math.round((stats.feedback.good / stats.feedback.total) * 100)
                          : 0}%
                      </span>
                      <span className="text-xs text-slate-400">Positive</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Q&A */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Q&A Activity</h3>
              <div className="space-y-3">
                {qaPairs.slice(0, 5).map((qa) => (
                  <div key={qa.id} className="bg-slate-900/50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{truncateText(qa.question, 80)}</p>
                        <p className="text-slate-400 text-sm mt-1 truncate">{truncateText(qa.answer, 100)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {qa.rating === 'GOOD' && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                            Good
                          </span>
                        )}
                        {qa.rating === 'BAD' && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                            Bad
                          </span>
                        )}
                        <span className="text-slate-500 text-xs">{formatDate(qa.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {qaPairs.length === 0 && (
                  <p className="text-slate-500 text-center py-8">No Q&A activity yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Evolution Timeline Tab */}
        {activeTab === 'evolution' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Evolution Timeline</h3>
                <button
                  onClick={() => router.push('/admin/evolution')}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Run Evolution
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-slate-400">No evolution history yet</p>
                  <p className="text-slate-500 text-sm mt-1">Evolution will trigger when documents receive enough bad feedback</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />
                  <div className="space-y-6">
                    {history.map((h, idx) => (
                      <div key={h.id} className="relative pl-12">
                        <div className={`absolute left-2 w-5 h-5 rounded-full border-2 ${
                          h.win_rate !== null && h.win_rate >= 0.5
                            ? 'bg-green-500 border-green-400'
                            : 'bg-slate-600 border-slate-500'
                        }`} />
                        <div className="bg-slate-900/50 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-white font-medium">{h.document?.file_name || 'Unknown Document'}</p>
                              <p className="text-slate-400 text-sm mt-1">Generation {h.generation}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-3 py-1 rounded-lg text-xs font-medium ${
                                h.mutation_type === 'MUTATION_CLARITY'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : h.mutation_type === 'MUTATION_DETAIL'
                                    ? 'bg-green-500/20 text-green-400'
                                    : h.mutation_type === 'MUTATION_QA_FORMAT'
                                      ? 'bg-purple-500/20 text-purple-400'
                                      : 'bg-slate-600/50 text-slate-400'
                              }`}>
                                {h.mutation_type.replace('MUTATION_', '')}
                              </span>
                              {h.win_rate !== null && (
                                <p className="text-slate-400 text-sm mt-2">
                                  Win Rate: <span className={h.win_rate >= 0.5 ? 'text-green-400' : 'text-red-400'}>
                                    {Math.round(h.win_rate * 100)}%
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-500 text-xs mt-3">{formatDate(h.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Q&A Logs Tab */}
        {activeTab === 'qa-logs' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Q&A History</h3>
                <div className="flex gap-2">
                  {['all', 'GOOD', 'BAD'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setRatingFilter(filter)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        ratingFilter === filter
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                          : 'bg-slate-700/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      {filter === 'all' ? 'All' : filter === 'GOOD' ? 'Good' : 'Bad'}
                    </button>
                  ))}
                </div>
              </div>

              {qaPairs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <p className="text-slate-400">No Q&A logs found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qaPairs.map((qa) => (
                    <div
                      key={qa.id}
                      className="bg-slate-900/50 rounded-xl overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setExpandedQA(expandedQA === qa.id ? null : qa.id)}
                        className="w-full p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {qa.rating === 'GOOD' && (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                  Good
                                </span>
                              )}
                              {qa.rating === 'BAD' && (
                                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                                  Bad
                                </span>
                              )}
                              <span className="text-slate-500 text-xs">{formatDate(qa.createdAt)}</span>
                            </div>
                            <p className="text-white font-medium">
                              {expandedQA === qa.id ? qa.question : truncateText(qa.question, 100)}
                            </p>
                          </div>
                          <svg
                            className={`w-5 h-5 text-slate-400 transition-transform ${
                              expandedQA === qa.id ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {expandedQA === qa.id && (
                        <div className="px-4 pb-4 border-t border-slate-700/50 mt-2 pt-4">
                          <div className="mb-4">
                            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Answer</p>
                            <div className="bg-slate-800/50 rounded-lg p-3">
                              <p className="text-slate-300 text-sm whitespace-pre-wrap">{qa.answer}</p>
                            </div>
                          </div>
                          {qa.feedbackText && (
                            <div>
                              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">User Feedback</p>
                              <div className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-slate-300 text-sm">{qa.feedbackText}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

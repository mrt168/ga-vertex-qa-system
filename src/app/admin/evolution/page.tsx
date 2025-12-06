'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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

interface EvolutionJob {
  id: string;
  documentId: string;
  status: string;
  candidates: unknown[];
  evaluationResults: unknown[];
  winnerCandidateId?: string;
  error?: string;
}

export default function EvolutionAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [history, setHistory] = useState<EvolutionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastJob, setLastJob] = useState<EvolutionJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Unknown error');
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchHistory()]);
      setLoading(false);
    };
    init();
  }, [fetchStats, fetchHistory]);

  const runEvolution = async () => {
    setRunning(true);
    setError(null);
    setLastJob(null);

    try {
      const res = await fetch('/api/evolution/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Evolution failed');
      }

      const data = await res.json();
      setLastJob(data.jobs || [data.job]);

      // Refresh stats and history
      await Promise.all([fetchStats(), fetchHistory()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">進化管理</h1>
          <button
            onClick={() => router.push('/qa')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← QAに戻る
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">総ドキュメント</h3>
            <p className="text-3xl font-bold text-gray-900">{stats?.documents.total || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">総フィードバック</h3>
            <p className="text-3xl font-bold text-gray-900">{stats?.feedback.total || 0}</p>
            <p className="text-sm text-gray-500">
              👍 {stats?.feedback.good || 0} / 👎 {stats?.feedback.bad || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">未処理低評価</h3>
            <p className="text-3xl font-bold text-orange-600">{stats?.feedback.pendingBad || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">進化対象</h3>
            <p className="text-3xl font-bold text-blue-600">
              {stats?.evolution.eligibleDocuments || 0}
            </p>
            <p className="text-sm text-gray-500">
              閾値: {stats?.evolution.threshold || 3}件以上
            </p>
          </div>
        </div>

        {/* Evolution Control */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">進化実行</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={runEvolution}
              disabled={running || (stats?.evolution.eligibleDocuments || 0) === 0}
              className={`px-6 py-3 rounded-lg font-medium ${
                running || (stats?.evolution.eligibleDocuments || 0) === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {running ? '実行中...' : '進化を実行'}
            </button>
            <p className="text-gray-600">
              {stats?.evolution.eligibleDocuments === 0
                ? '進化対象のドキュメントがありません'
                : `${stats?.evolution.eligibleDocuments}件のドキュメントが進化対象です`}
            </p>
          </div>

          {lastJob && lastJob.length > 0 && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">最新の実行結果</h3>
              {lastJob.map((job) => (
                <div key={job.id} className="text-sm text-gray-600 mb-2">
                  <p>
                    ドキュメント: {job.documentId} | ステータス: {job.status}
                    {job.winnerCandidateId && ` | 勝者: ${job.winnerCandidateId}`}
                    {job.error && ` | エラー: ${job.error}`}
                  </p>
                  <p>
                    候補数: {job.candidates.length} | 評価結果: {job.evaluationResults.length}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evolution History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">進化履歴</h2>
          {history.length === 0 ? (
            <p className="text-gray-500">進化履歴がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      日時
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      ドキュメント
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      世代
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      変異タイプ
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      勝率
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(h.created_at).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {h.document?.file_name || h.document_id}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{h.generation}</td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            h.mutation_type === 'MUTATION_CLARITY'
                              ? 'bg-blue-100 text-blue-800'
                              : h.mutation_type === 'MUTATION_DETAIL'
                                ? 'bg-green-100 text-green-800'
                                : h.mutation_type === 'MUTATION_QA_FORMAT'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {h.mutation_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {h.win_rate !== null ? `${(h.win_rate * 100).toFixed(0)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Evolution Statistics */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">進化統計</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">総進化回数</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.evolution.totalEvolutions || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">成功した進化</p>
              <p className="text-2xl font-bold text-green-600">
                {stats?.evolution.successfulEvolutions || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

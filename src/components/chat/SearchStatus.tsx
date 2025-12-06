'use client';

import { useEffect, useState } from 'react';
import { Search, FileText, Brain, Sparkles } from 'lucide-react';

const STATUS_MESSAGES = [
  { icon: Search, text: 'ドキュメントを検索中...', subtext: '社内ナレッジベースから関連情報を探しています' },
  { icon: FileText, text: '関連ファイルを分析中...', subtext: 'PDF・Googleドキュメントの内容を読み取っています' },
  { icon: Brain, text: '情報を整理中...', subtext: '質問に最も関連する内容を抽出しています' },
  { icon: Sparkles, text: '回答を生成中...', subtext: 'Gemini AIが回答を作成しています' },
];

const STATUS_INTERVAL = 2500; // 2.5 seconds per status

export function SearchStatus() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
        setIsTransitioning(false);
      }, 200);
    }, STATUS_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const currentStatus = STATUS_MESSAGES[currentIndex];
  const Icon = currentStatus.icon;

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg px-4 py-3 max-w-md border border-blue-100 dark:border-gray-600">
        <div
          className={`flex items-start gap-3 transition-opacity duration-200 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            <div className="relative">
              <Icon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {currentStatus.text}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {currentStatus.subtext}
            </p>
          </div>
        </div>
        {/* Progress indicator */}
        <div className="mt-3 flex gap-1.5">
          {STATUS_MESSAGES.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                index <= currentIndex
                  ? 'bg-blue-500 dark:bg-blue-400'
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

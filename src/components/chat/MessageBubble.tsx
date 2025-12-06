'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QaevMessage } from '@/types/database';
import { FeedbackButtons } from './FeedbackButtons';

interface MessageBubbleProps {
  message: QaevMessage;
  onFeedback?: (messageId: string, rating: 'GOOD' | 'BAD', feedbackText?: string) => Promise<void>;
}

export function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      onMouseEnter={() => !isUser && setShowFeedback(true)}
      onMouseLeave={() => setShowFeedback(false)}
    >
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Headings
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-4 mb-2 border-b border-blue-200 dark:border-blue-800 pb-1">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-bold text-blue-600 dark:text-blue-300 mt-3 mb-2">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-blue-500 dark:text-blue-200 mt-2 mb-1">
                      {children}
                    </h3>
                  ),
                  // Bold text
                  strong: ({ children }) => (
                    <strong className="font-bold text-orange-600 dark:text-orange-400">
                      {children}
                    </strong>
                  ),
                  // Italic text
                  em: ({ children }) => (
                    <em className="italic text-purple-600 dark:text-purple-400 underline decoration-purple-300 dark:decoration-purple-600">
                      {children}
                    </em>
                  ),
                  // Code blocks
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-gray-200 dark:bg-gray-700 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-sm font-mono">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className={`${className} block bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm font-mono`} {...props}>
                        {children}
                      </code>
                    );
                  },
                  // Pre blocks (code block wrapper)
                  pre: ({ children }) => (
                    <pre className="bg-gray-900 rounded-lg overflow-x-auto my-2">
                      {children}
                    </pre>
                  ),
                  // Links
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline decoration-blue-400 dark:decoration-blue-600 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      {children}
                    </a>
                  ),
                  // Lists
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside my-2 space-y-1 text-gray-800 dark:text-gray-200">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside my-2 space-y-1 text-gray-800 dark:text-gray-200">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-gray-800 dark:text-gray-200">
                      {children}
                    </li>
                  ),
                  // Blockquote
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 my-2 italic text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 py-2 rounded-r">
                      {children}
                    </blockquote>
                  ),
                  // Tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border border-gray-300 dark:border-gray-600 rounded">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="bg-gray-200 dark:bg-gray-700 px-3 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-600">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      {children}
                    </td>
                  ),
                  // Horizontal rule
                  hr: () => (
                    <hr className="my-4 border-gray-300 dark:border-gray-600" />
                  ),
                  // Paragraphs
                  p: ({ children }) => (
                    <p className="my-2 text-gray-800 dark:text-gray-200 leading-relaxed">
                      {children}
                    </p>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && Array.isArray(message.sources) && message.sources.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">📚 Sources:</span>
            <ul className="ml-2 mt-1 space-y-1">
              {(message.sources as { fileName: string; documentId?: string; driveUrl?: string }[]).map((source, idx) => {
                // Extract file ID by removing 'drive:' prefix if present
                const extractFileId = (id: string) => id.replace(/^drive:/, '');

                // Use driveUrl if available, otherwise try to build from documentId
                let url = source.driveUrl;
                if (!url && source.documentId) {
                  const fileId = extractFileId(source.documentId);
                  url = `https://drive.google.com/file/d/${fileId}/view`;
                }

                return (
                  <li key={idx} className="flex items-center gap-1">
                    <span className="text-gray-400">•</span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors truncate max-w-[300px] inline-flex items-center gap-1"
                        title={source.fileName}
                      >
                        {source.fileName}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ) : (
                      <span className="truncate max-w-[300px]">{source.fileName}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Feedback buttons for assistant messages */}
        {!isUser && onFeedback && (
          <div
            className={`mt-2 transition-opacity duration-200 ${
              showFeedback || message.feedback_id ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <FeedbackButtons
              messageId={message.id}
              currentFeedback={message.feedback_id ? 'submitted' : undefined}
              onFeedback={onFeedback}
            />
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`mt-1 text-xs text-gray-400 ${isUser ? 'text-right' : 'text-left'}`}
        >
          {new Date(message.created_at).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';

interface FeedbackButtonsProps {
  messageId: string;
  currentFeedback?: 'submitted';
  onFeedback: (messageId: string, rating: 'GOOD' | 'BAD', feedbackText?: string) => Promise<void>;
}

export function FeedbackButtons({
  messageId,
  currentFeedback,
  onFeedback,
}: FeedbackButtonsProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!currentFeedback);
  const [selectedRating, setSelectedRating] = useState<'GOOD' | 'BAD' | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const handleClick = async (rating: 'GOOD' | 'BAD') => {
    if (submitted || submitting) return;

    setSelectedRating(rating);

    if (rating === 'BAD') {
      setShowTextInput(true);
    } else {
      await submitFeedback(rating);
    }
  };

  const submitFeedback = async (rating: 'GOOD' | 'BAD', text?: string) => {
    setSubmitting(true);
    try {
      await onFeedback(messageId, rating, text);
      setSubmitted(true);
      setShowTextInput(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWithText = async () => {
    if (selectedRating) {
      await submitFeedback(selectedRating, feedbackText || undefined);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Check className="h-3 w-3" />
        <span>Feedback submitted</span>
      </div>
    );
  }

  if (showTextInput) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="What could be improved? (optional)"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSubmitWithText}
            disabled={submitting}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Submit'}
          </button>
          <button
            onClick={() => {
              setShowTextInput(false);
              setSelectedRating(null);
            }}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleClick('GOOD')}
        disabled={submitting}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-green-50 hover:text-green-600 dark:text-gray-400 dark:hover:bg-green-900/20 dark:hover:text-green-400"
        title="Helpful"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => handleClick('BAD')}
        disabled={submitting}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        title="Not helpful"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Loader2, AlertCircle, Clock, Code2 } from 'lucide-react';
import apiClient from '../api/axios';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';
import { renderReviewMarkdown } from '../utils/reviewMarkdown';

interface SharedReview {
  id: string;
  repoName: string;
  fileName: string;
  score: number;
  summary: string;
  createdAt: string;
  details: Record<string, unknown>;
}

export function SharedReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [review, setReview] = useState<SharedReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get('/ai/code-review/shared/' + token);
        const data = res.data.data;
        setReview({
          id: data.id,
          repoName: data.repoName || '',
          fileName: data.fileName || '',
          score: data.score,
          summary: data.summary || '',
          createdAt: data.createdAt,
          details: (data.details as Record<string, unknown>) || {},
        });
      } catch {
        setError('This shared review could not be found. It may have been deleted or the link is invalid.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const title = review?.repoName || review?.fileName || 'Code Review';
  const markdown = review
    ? renderReviewMarkdown({ ...review.details, score: review.score, summary: review.summary || review.details.summary })
    : '';

  return (
    <div className="min-h-screen min-h-dvh bg-surface-950 text-surface-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-xs font-medium text-surface-300 transition-all hover:border-surface-600 hover:text-surface-100"
            >
              <Code2 className="h-3.5 w-3.5" />
              DevMind AI
            </Link>
            {review && (
              <span
                className={
                  'flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ' +
                  (review.score >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                   review.score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                   'bg-red-500/10 text-red-400')
                }
              >
                {review.score}/100
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-surface-700 bg-surface-900/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-surface-700 bg-surface-900/80 px-4 py-4 sm:px-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-surface-100 sm:text-lg">{title}</h1>
                {review?.createdAt && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-surface-500">
                    <Clock className="h-3 w-3" />
                    {new Date(review.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-surface-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="mt-3 text-xs">Loading shared review...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-400" />
                  <p className="mt-3 max-w-sm text-sm text-surface-300">{error}</p>
                  <Link
                    to="/"
                    className="mt-5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-primary-700"
                  >
                    Go to DevMind AI
                  </Link>
                </div>
              ) : (
                <div className="max-w-none">
                  <MarkdownRenderer content={markdown} />
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-surface-600">
            Shared via DevMind AI · {review?.repoName || 'Code Review'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

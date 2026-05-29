import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import { Link } from 'react-router-dom';

interface Props {
  orgSlug: string;
  projectSlug: string;
  hasApiKey: boolean;
}

export function WikiSearch({ orgSlug, projectSlug, hasApiKey }: Props) {
  const [question, setQuestion] = useState('');
  const [reasoning, setReasoning] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [reasoningText, setReasoningText] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setReasoningText(null);
    setSources([]);
    try {
      const result = await api.wiki.search(orgSlug, projectSlug, question, reasoning);
      setAnswer(result.answer);
      setReasoningText(result.reasoning ?? null);
      setSources(result.sources);
    } catch (err: any) {
      if (err.status === 400) {
        setError(err.message ?? 'No API key configured or wiki not available.');
      } else {
        setError(err.message ?? 'Search failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!hasApiKey) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
        <Link to={`/orgs/${orgSlug}/projects/${projectSlug}/settings`} className="text-purple-600 hover:underline">
          Add an API key
        </Link>{' '}
        to enable wiki search.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about architecture, APIs, flows..."
            disabled={loading}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={reasoning}
            onChange={(e) => setReasoning(e.target.checked)}
            disabled={loading}
          />
          Include reasoning
        </label>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {answer && (
        <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 space-y-3">
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
          {reasoningText && (
            <details className="border-t border-gray-100 pt-2 text-sm text-gray-700">
              <summary className="cursor-pointer font-medium">Reasoning</summary>
              <div className="prose prose-sm max-w-none mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoningText}</ReactMarkdown>
              </div>
            </details>
          )}
          {sources.length > 0 && (
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
              <span className="font-medium">Sources:</span>{' '}
              {sources.map((slug) => (
                <span key={slug} className="inline-block bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 mr-1 font-mono">
                  {slug}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

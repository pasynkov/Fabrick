import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

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
      <Card className="px-4 py-3 text-sm text-text-muted">
        <Link to={`/orgs/${orgSlug}/projects/${projectSlug}/settings`} className="text-accent-indigo hover:text-accent-indigo-dim">
          Add an API key
        </Link>{' '}
        to enable wiki search.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about architecture, APIs, flows..."
            disabled={loading}
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading || !question.trim()}
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-muted">
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
        <Card className="px-4 py-3 border-danger/30">
          <span className="text-sm text-danger">{error}</span>
        </Card>
      )}

      {answer && (
        <Card className="px-5 py-4 space-y-3">
          <div className="markdown-body text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
          {reasoningText && (
            <details className="border-t border-border pt-2 text-sm text-text-muted">
              <summary className="cursor-pointer font-medium text-text-primary">Reasoning</summary>
              <div className="markdown-body text-sm mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoningText}</ReactMarkdown>
              </div>
            </details>
          )}
          {sources.length > 0 && (
            <div className="text-xs text-text-muted border-t border-border pt-2">
              <span className="font-medium">Sources:</span>{' '}
              {sources.map((slug) => (
                <span key={slug} className="inline-block bg-surface-2 border border-border text-text-muted rounded px-1.5 py-0.5 mr-1 font-mono">
                  {slug}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

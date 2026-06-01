import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import { Card } from './ui/Card';

interface Props {
  orgSlug: string;
  projectSlug: string;
  slug: string;
  onBack: () => void;
  onNavigate: (slug: string) => void;
}

export function WikiPageView({ orgSlug, projectSlug, slug, onBack, onNavigate }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.synthesis.file(orgSlug, projectSlug, slug)
      .then((text) => {
        // Strip YAML frontmatter before rendering
        const stripped = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
        setContent(stripped);
      })
      .catch((err) => setError(err.message ?? 'Failed to load page'))
      .finally(() => setLoading(false));
  }, [orgSlug, projectSlug, slug]);

  function handleLinkClick(href: string | undefined) {
    if (!href) return;
    // Detect relative wiki links like ../entities/user.md or entities/user.md
    const mdMatch = href.match(/(?:\.\.\/)?([^/]+\/[^/]+|[^/]+)\.md$/);
    if (mdMatch) {
      onNavigate(mdMatch[1]);
      return;
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
      >
        ← Back to pages
      </button>

      {loading && <p className="text-text-muted text-sm">Loading...</p>}
      {error && <p className="text-danger text-sm">{error}</p>}

      {content && (
        <Card className="px-6 py-5">
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const isWikiLink = href && (href.endsWith('.md') || href.startsWith('../'));
                  if (isWikiLink) {
                    return (
                      <button
                        onClick={() => handleLinkClick(href)}
                        className="text-accent-indigo hover:text-accent-indigo-dim underline"
                      >
                        {children}
                      </button>
                    );
                  }
                  return <a href={href} target="_blank" rel="noreferrer" className="text-accent-indigo hover:text-accent-indigo-dim underline">{children}</a>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';

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
        className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
      >
        ← Back to pages
      </button>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {content && (
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const isWikiLink = href && (href.endsWith('.md') || href.startsWith('../'));
                  if (isWikiLink) {
                    return (
                      <button
                        onClick={() => handleLinkClick(href)}
                        className="text-purple-600 hover:underline"
                      >
                        {children}
                      </button>
                    );
                  }
                  return <a href={href} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">{children}</a>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

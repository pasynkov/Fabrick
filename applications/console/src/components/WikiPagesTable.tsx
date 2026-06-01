import { useEffect, useState } from 'react';
import { api } from '../api';
import type { WikiPageSummary } from '../api';
import { Card } from './ui/Card';

interface Props {
  orgSlug: string;
  projectSlug: string;
  onSelectPage: (slug: string) => void;
}

export function WikiPagesTable({ orgSlug, projectSlug, onSelectPage }: Props) {
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.synthesis.pages(orgSlug, projectSlug)
      .then((res) => setPages(res.pages))
      .catch((err) => setError(err.message ?? 'Failed to load wiki pages'))
      .finally(() => setLoading(false));
  }, [orgSlug, projectSlug]);

  if (loading) return <p className="text-text-muted text-sm">Loading wiki pages...</p>;
  if (error) return <p className="text-danger text-sm">{error}</p>;
  if (pages.length === 0) return <p className="text-text-muted text-sm">No wiki pages yet. Run synthesis to generate them.</p>;

  // Group by category
  const grouped = pages.reduce<Record<string, WikiPageSummary[]>>((acc, page) => {
    const cat = page.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(page);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{cat}</h4>
          <Card className="divide-y divide-border overflow-hidden">
            {grouped[cat].map((page) => (
              <div key={page.slug} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2 transition-colors duration-200">
                <button
                  onClick={() => onSelectPage(page.slug)}
                  className="text-sm font-medium text-accent-indigo hover:text-accent-indigo-dim text-left"
                >
                  {page.title}
                </button>
                <span className="text-xs text-text-muted ml-4 shrink-0">
                  {new Date(page.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

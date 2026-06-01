import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { AppLayout } from '../components/ui/AppLayout';
import { Card } from '../components/ui/Card';

interface Org { id: string; name: string; slug: string; role: string }

export default function OrgList() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.orgs.list().then(setOrgs).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <h2 className="text-xl font-semibold mb-6 text-text-primary">Organizations</h2>
      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : orgs.length === 0 ? (
        <p className="text-text-muted">No organizations yet.</p>
      ) : (
        <ul className="space-y-2">
          {orgs.map((org) => (
            <li key={org.id} className="flex items-center gap-2">
              <Card interactive as={Link} to={`/orgs/${org.slug}`} className="flex-1 block px-4 py-3">
                <span className="font-medium text-text-primary">{org.name}</span>
                <span className="ml-2 text-xs text-text-muted">{org.slug}</span>
                <span className="ml-2 text-xs text-accent-indigo">{org.role}</span>
              </Card>
              {org.role === 'admin' && (
                <Link
                  to={`/orgs/${org.slug}/edit`}
                  className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 border border-border bg-surface-1/50 text-text-primary hover:bg-surface-2 px-3 py-1.5 text-xs"
                >
                  Edit
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}

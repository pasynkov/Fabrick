import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
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
                <Button as={Link} to={`/orgs/${org.slug}/edit`} variant="secondary" size="sm">
                  Edit
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}

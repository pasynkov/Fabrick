import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AdminPromptListItem } from '../api';

export default function PromptsList() {
  const [items, setItems] = useState<AdminPromptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.admin.prompts.list()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Prompts</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No prompts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border border-gray-200">Name</th>
                <th className="p-2 border border-gray-200">Agent</th>
                <th className="p-2 border border-gray-200">Revision</th>
                <th className="p-2 border border-gray-200">Updated At</th>
                <th className="p-2 border border-gray-200">Created By</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-2 border border-gray-200">
                    <Link
                      to={`/prompts/${encodeURIComponent(item.name)}/${encodeURIComponent(item.agent)}`}
                      className="text-purple-600 hover:underline"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="p-2 border border-gray-200">{item.agent}</td>
                  <td className="p-2 border border-gray-200">{item.revision}</td>
                  <td className="p-2 border border-gray-200">{new Date(item.updatedAt).toLocaleString()}</td>
                  <td className="p-2 border border-gray-200 font-mono text-xs">{item.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

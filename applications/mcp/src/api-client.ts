export async function searchProject(
  apiUrl: string,
  org: string,
  project: string,
  question: string,
  token: string,
): Promise<{ answer: string; sources: string[] }> {
  const url = `${apiUrl}/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error(`Search API returned ${res.status}`);
  }
  return res.json() as Promise<{ answer: string; sources: string[] }>;
}

export async function getToolDescription(
  apiUrl: string,
  org: string,
  project: string,
  token: string,
): Promise<string> {
  const url = `${apiUrl}/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/synthesis/file?path=${encodeURIComponent('mcp-description')}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  return res.text();
}

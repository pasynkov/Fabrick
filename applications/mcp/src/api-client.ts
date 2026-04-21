export async function getSynthesisFile(
  apiUrl: string,
  org: string,
  project: string,
  path: string,
  token: string,
): Promise<string> {
  const url = `${apiUrl}/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/synthesis/file?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  return res.text();
}

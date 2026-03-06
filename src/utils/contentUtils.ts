export function extractTitle(content: string): string {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let title = lines[0] || '';

  title = title.replace(/:[a-zA-Z0-9_+-]+:/g, '').trim();

  return title;
}
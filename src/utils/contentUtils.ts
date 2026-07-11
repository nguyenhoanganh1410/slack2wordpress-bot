export function normalizeSlackContent(content: string): string {
  if (!content) {
    return '';
  }

  return content
    .replace(/<([a-zA-Z][a-zA-Z0-9+.-]*:[^>|]+)(?:\|([^>]+))?>/g, (_match, href, label) => {
      const displayText = label?.trim() || href;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
    })
    .replace(/\r\n/g, '\n');
}

export function extractTitle(content: string): string {
  const normalizedContent = normalizeSlackContent(content);
  const lines = normalizedContent.split('\n').map(l => l.trim()).filter(Boolean);
  let title = lines[0] || '';

  title = title.replace(/:[a-zA-Z0-9_+-]+:/g, '').trim();

  return title;
}
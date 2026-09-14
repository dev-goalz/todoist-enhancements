/**
 * A small Markdown renderer for task descriptions.
 *
 * Todoist descriptions are Markdown, and the reader should see the formatted
 * text rather than the syntax. Every input is HTML-escaped before any rule
 * runs, so the result can never carry markup that came from the source text.
 */

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Only http and https links become anchors; anything else stays plain text. */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** Stand-in for a code span while the other inline rules run. */
const CODE_SLOT = (index: number) => `@@code${index}@@`;

function inline(text: string): string {
  let out = escapeHtml(text);

  // Code spans are lifted out first so later rules cannot reach inside them.
  const codes: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(code);
    return CODE_SLOT(codes.length - 1);
  });

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const href = safeUrl(url);
    if (!href) return match;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Bare links that were not already wrapped by the rule above.
  out = out.replace(
    /(^|[\s(])(https?:\/\/[^\s<>"')]+)/g,
    (_match, lead: string, url: string) =>
      `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );

  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  out = out.replace(/@@code(\d+)@@/g, (_match, index: string) => `<code>${codes[Number(index)]}</code>`);
  return out;
}

/**
 * Renders one line of Markdown, inline rules only.
 *
 * A task row shows a single clamped line, so block structure — lists, code
 * fences, headings — has nowhere to go. Their markers are stripped and the
 * remaining lines joined, which is what a reader scanning the list wants:
 * emphasis and links formatted, syntax gone.
 */
export function renderInlineMarkdown(source: string): string {
  if (!source.trim()) return '';
  const line = source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((raw) => raw.trim())
    .filter((raw) => raw !== '' && !raw.startsWith('```'))
    .map((raw) => raw
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^>\s?/, ''))
    .join(' · ');
  return inline(line);
}

/** Renders a description to HTML that is safe to insert. */
export function renderMarkdown(source: string): string {
  if (!source.trim()) return '';

  const blocks: string[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let paragraph: string[] = [];
  let inFence = false;
  let fence: string[] = [];

  const flushList = () => {
    if (listType && listItems.length > 0) {
      blocks.push(`<${listType}>${listItems.map((i) => `<li>${i}</li>`).join('')}</${listType}>`);
    }
    listType = null;
    listItems = [];
  };

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inFence) {
        blocks.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
        fence = [];
        inFence = false;
      } else {
        flushParagraph();
        flushList();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fence.push(line);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      // Descriptions sit inside a dialog, so headings start below its own h2.
      const level = Math.min(6, heading[1].length + 2);
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(inline(bullet[1]));
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(inline(numbered[1]));
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (inFence && fence.length > 0) {
    blocks.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  flushList();

  return blocks.join('');
}

/** A description reduced to one readable line, for previews in a list. */
export const plainPreview = (source: string): string =>
  source.replace(/[*_`~#>[\]]/g, '').replace(/\s+/g, ' ').trim();

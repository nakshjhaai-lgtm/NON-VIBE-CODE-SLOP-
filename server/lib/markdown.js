/**
 * A deliberately small Markdown renderer.
 *
 * Only the constructs the site's own content uses are supported. Content is
 * authored in-repo, but it is still rendered through the same escaping used
 * everywhere else: no raw HTML passthrough, so a stray angle bracket in prose
 * can never become markup.
 *
 * Supported: ATX headings, paragraphs, unordered and ordered lists, fenced
 * code, blockquotes, tables, horizontal rules, links, bold, italic, inline
 * code, and footnote-style reference links.
 */
import { escapeHtml } from './html.js';

/** Turns a heading into a stable, readable anchor id. */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function inline(text) {
  let out = escapeHtml(text);

  // Inline code first, so its contents are not further transformed.
  const codes = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });

  // Links: [label](href). Only http(s), mailto, tel and site-relative URLs.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
    const safe = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href);
    if (!safe) return label;
    const external = /^https?:\/\//i.test(href);
    const attrs = external ? ' rel="noopener noreferrer"' : '';
    return `<a href="${href}"${attrs}>${label}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // deno-lint-ignore no-control-regex
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  return out;
}

/**
 * @returns {{ html: string, headings: Array<{level:number,text:string,id:string}> }}
 */
export function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  let i = 0;

  const flushParagraph = (buffer) => {
    if (buffer.length) out.push(`<p>${inline(buffer.join(' '))}</p>`);
    buffer.length = 0;
  };

  const paragraph = [];

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (/^```/.test(line)) {
      flushParagraph(paragraph);
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(body.join('\n'))}\n</code></pre>`);
      continue;
    }

    // headings
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(paragraph);
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      headings.push({ level, text, id });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // horizontal rule
    if (/^(---|\*\*\*)\s*$/.test(line)) {
      flushParagraph(paragraph);
      out.push('<hr>');
      i++;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      flushParagraph(paragraph);
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(body.join('\n')).html}</blockquote>`);
      continue;
    }

    // table
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
      flushParagraph(paragraph);
      const cells = (row) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\|/.test(lines[i])) body.push(cells(lines[i++]));
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head
          .map((c) => `<th scope="col">${inline(c)}</th>`)
          .join('')}</tr></thead><tbody>${body
          .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }

    // lists
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      flushParagraph(paragraph);
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        let text = lines[i].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, '');
        i++;
        // continuation lines
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          text += ' ' + lines[i++].trim();
        }
        items.push(`<li>${inline(text)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(paragraph);
      i++;
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }

  flushParagraph(paragraph);
  return { html: out.join('\n'), headings };
}

/** Splits `key: value` front matter from the body. */
export function parseFrontMatter(source) {
  const text = String(source).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { meta: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { meta: {}, body: text };

  const meta = {};
  for (const line of text.slice(4, end).split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[key] = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      meta[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: text.slice(end + 4).replace(/^\n+/, '') };
}

/** Rough reading time, stated honestly as an estimate in the UI. */
export function readingMinutes(body) {
  const words = String(body).trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

/** Plain text extraction, used for search indexing and meta descriptions. */
export function toPlainText(markdown) {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^---[\s\S]*?\n---/, ' ')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

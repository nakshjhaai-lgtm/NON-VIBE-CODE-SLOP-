/**
 * Site search.
 *
 * An in-memory inverted index over page titles, summaries and body text.
 * Built once at startup from the same content the pages render, so a result
 * can never point at something that is not there.
 *
 * Scoring is deliberately simple and explainable: title matches outweigh
 * summary matches, which outweigh body matches, and a phrase match is worth
 * more than scattered terms. No result is shown without a real excerpt.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'to', 'was', 'were', 'will', 'with',
]);

function tokenise(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9.+-]+/)
    .map((t) => t.replace(/^[.+-]+|[.+-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

const documents = [];

/**
 * @param {{ url: string, title: string, summary: string, body?: string, section: string, updated?: string }} doc
 */
export function addDocument(doc) {
  documents.push({
    ...doc,
    body: doc.body || '',
    tokens: {
      title: tokenise(doc.title),
      summary: tokenise(doc.summary),
      body: tokenise(doc.body || ''),
    },
  });
}

export function documentCount() {
  return documents.length;
}

export function clearIndex() {
  documents.length = 0;
}

/** Builds a short excerpt centred on the first matching term. */
function excerpt(text, terms, length = 190) {
  const plain = String(text).replace(/\s+/g, ' ').trim();
  if (!plain) return '';

  const lower = plain.toLowerCase();
  let at = -1;
  for (const term of terms) {
    at = lower.indexOf(term);
    if (at !== -1) break;
  }
  if (at === -1) return plain.slice(0, length) + (plain.length > length ? '\u2026' : '');

  const start = Math.max(0, at - 60);
  const end = Math.min(plain.length, start + length);
  return (start > 0 ? '\u2026' : '') + plain.slice(start, end).trim() + (end < plain.length ? '\u2026' : '');
}

/**
 * @param {string} query
 * @returns {Array<{url:string,title:string,section:string,excerpt:string,score:number}>}
 */
export function search(query, { limit = 20 } = {}) {
  const terms = tokenise(query);
  if (terms.length === 0) return [];

  const phrase = String(query).toLowerCase().trim();
  const results = [];

  for (const doc of documents) {
    let score = 0;
    let matched = 0;

    for (const term of terms) {
      const inTitle = doc.tokens.title.filter((t) => t === term || t.startsWith(term)).length;
      const inSummary = doc.tokens.summary.filter((t) => t === term || t.startsWith(term)).length;
      const inBody = doc.tokens.body.filter((t) => t === term || t.startsWith(term)).length;

      if (inTitle + inSummary + inBody === 0) continue;
      matched++;
      score += inTitle * 12 + inSummary * 5 + Math.min(inBody, 8) * 1.5;
    }

    if (matched === 0) continue;

    // Require every term for multi-word queries, so results stay relevant.
    if (terms.length > 1 && matched < terms.length) score *= 0.35;

    if (doc.title.toLowerCase().includes(phrase)) score += 25;
    else if (`${doc.summary} ${doc.body}`.toLowerCase().includes(phrase)) score += 10;

    results.push({
      url: doc.url,
      title: doc.title,
      section: doc.section,
      updated: doc.updated,
      excerpt: excerpt(doc.body || doc.summary, terms),
      score: Math.round(score * 10) / 10,
    });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

/**
 * Suggests alternatives when nothing matched, using single-character edit
 * distance against indexed title terms. Better than a bare "no results".
 */
export function suggest(query) {
  const terms = tokenise(query);
  if (terms.length === 0) return [];

  const vocabulary = new Set();
  for (const doc of documents) for (const t of doc.tokens.title) vocabulary.add(t);

  const out = new Set();
  for (const term of terms) {
    for (const word of vocabulary) {
      if (Math.abs(word.length - term.length) > 2) continue;
      if (editDistance(word, term) <= (term.length > 5 ? 2 : 1)) out.add(word);
    }
  }
  return [...out].slice(0, 5);
}

function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i++) {
    const curr = [i];
    for (let j = 1; j < cols; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[cols - 1];
}

/** Highlights matched terms in an excerpt. Returns escaped HTML. */
export function highlight(text, query, escape) {
  const terms = [...new Set(tokenise(query))].sort((a, b) => b.length - a.length);
  const escaped = escape(text);
  if (terms.length === 0) return escaped;

  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return escaped.replace(pattern, '<mark>$1</mark>');
}

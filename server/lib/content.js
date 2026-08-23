/**
 * Content loading.
 *
 * Markdown under `content/` is read once at startup, parsed, rendered and
 * cached. Reading at startup rather than per request means a request never
 * touches the filesystem, and a malformed file fails loudly at boot instead
 * of producing a broken page later.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter, renderMarkdown, readingMinutes, toPlainText } from './markdown.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT_DIR = join(ROOT, 'content');

function loadDirectory(name) {
  let entries;
  try {
    entries = readdirSync(join(CONTENT_DIR, name));
  } catch {
    return [];
  }

  return entries
    .filter((file) => extname(file) === '.md')
    .map((file) => {
      const path = join(CONTENT_DIR, name, file);
      const source = readFileSync(path, 'utf8');
      const { meta, body } = parseFrontMatter(source);
      const slug = basename(file, '.md');

      if (!meta.title) throw new Error(`content/${name}/${file} is missing a title in its front matter`);
      if (!meta.description) throw new Error(`content/${name}/${file} is missing a description in its front matter`);

      const { html: rendered, headings } = renderMarkdown(body);
      const plain = toPlainText(body);

      return {
        slug,
        ...meta,
        tags: Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [],
        order: meta.order ? Number(meta.order) : 99,
        html: rendered,
        headings,
        plain,
        readingMinutes: readingMinutes(body),
        fileModified: statSync(path).mtime.toISOString().slice(0, 10),
      };
    });
}

const docs = loadDirectory('docs').sort(
  (a, b) => a.order - b.order || a.title.localeCompare(b.title),
);

const posts = loadDirectory('blog').sort((a, b) => String(b.date).localeCompare(String(a.date)));

/** Docs grouped into the sections used by the sidebar, order preserved. */
export function docSections() {
  const sections = [];
  for (const doc of docs) {
    const name = doc.section || 'Documentation';
    let group = sections.find((s) => s.name === name);
    if (!group) {
      group = { name, docs: [] };
      sections.push(group);
    }
    group.docs.push(doc);
  }
  return sections;
}

export function allDocs() {
  return docs;
}

export function getDoc(slug) {
  return docs.find((doc) => doc.slug === slug);
}

export function allPosts() {
  return posts;
}

export function getPost(slug) {
  return posts.find((post) => post.slug === slug);
}

/** Posts sharing at least one tag, most recent first. */
export function relatedPosts(post, limit = 2) {
  return posts
    .filter((other) => other.slug !== post.slug && other.tags.some((tag) => post.tags.includes(tag)))
    .slice(0, limit);
}

export function allTags() {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/** Adjacent documentation pages, for previous/next links. */
export function docNeighbours(slug) {
  const index = docs.findIndex((doc) => doc.slug === slug);
  return {
    previous: index > 0 ? docs[index - 1] : null,
    next: index >= 0 && index < docs.length - 1 ? docs[index + 1] : null,
  };
}

/** The most recent modification across all content, for the sitemap. */
export function lastContentUpdate() {
  const dates = [...docs, ...posts].map((item) => item.updated || item.date || item.fileModified);
  return dates.sort().at(-1);
}

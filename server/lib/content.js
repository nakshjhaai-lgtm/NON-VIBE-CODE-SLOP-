/**
 * Content loading for the filesystem-free edge runtime.
 *
 * The checked-in snapshot contains the exact Markdown sources under
 * `content/`. They are parsed, rendered and cached once when the edge bundle
 * starts, just as they were in the former long-running server, but no runtime
 * filesystem (and no build step) is required.
 */
import { contentFiles } from './content-data.js';
import { parseFrontMatter, renderMarkdown, readingMinutes, toPlainText } from './markdown.js';

function loadDirectory(name) {
  const entries = contentFiles[name] || [];

  return entries.map(({ file, source, modified }) => {
    const { meta, body } = parseFrontMatter(source);
    const slug = file.replace(/\.md$/, '');

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
      fileModified: modified,
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
    let group = sections.find((section) => section.name === name);
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

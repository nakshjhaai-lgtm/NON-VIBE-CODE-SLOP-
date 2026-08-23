/**
 * Documentation index, a single document, and the blog equivalents.
 */
import { html, raw } from '../../lib/html.js';
import { icon } from '../icons.js';
import { site } from '../../lib/site.js';
import { pageHeader, formatDate, copyStatusRegion, emptyState } from '../components.js';
import { docSections, allDocs, allPosts, allTags, lastContentUpdate } from '../../lib/content.js';

/* --------------------------------------------------------------- docs */

export function docsIndexPage() {
  const sections = docSections();

  return html`
    ${pageHeader({
      title: 'Documentation',
      lead: `Setting it up, running it, and the parts where it does not work. ${allDocs().length} pages, all of them short.`,
      updated: lastContentUpdate(),
    })}

    <div class="section">
      <div class="container">
        <div class="stack-lg">
          ${sections.map(
            (section) => html`
              <section aria-labelledby="section-${section.id}">
                <div class="section__intro">
                  <h2 id="section-${section.id}">${section.title}</h2>
                </div>
                <div class="grid grid--2">
                  ${section.docs.map(
                    (doc) => html`
                      <article class="panel">
                        <h3><a href="/docs/${doc.slug}">${doc.title}</a></h3>
                        <p>${doc.description}</p>
                        <p class="text-sm text-muted">
                          ${doc.readingMinutes} minute read &middot; updated
                          <time datetime="${doc.updated}">${formatDate(doc.updated)}</time>
                        </p>
                      </article>
                    `,
                  )}
                </div>
              </section>
            `,
          )}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="split">
          <div>
            <h2>Cannot find it</h2>
            <p>
              The <a href="/search">site search</a> covers documentation, notes and pages. If the answer is genuinely
              not here, <a href="/contact?topic=documentation">tell us what you were looking for</a> and we will write
              it. That is where most of these pages came from.
            </p>
          </div>
          <div>
            <h2>Reading offline</h2>
            <p>
              Every page on this site has a print stylesheet that drops the navigation, expands abbreviated links to
              their full URLs and keeps code blocks intact. Printing to PDF produces something usable next to a
              router.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function docPage({ doc, neighbours }) {
  return html`
    ${pageHeader({
      title: doc.title,
      lead: doc.description,
      updated: doc.updated,
      meta: `${doc.readingMinutes} minute read`,
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <article class="prose">
            ${raw(doc.html)}

            <hr />
            <p class="text-sm text-muted">
              Something wrong or missing on this page?
              <a href="/contact?topic=documentation&amp;page=${encodeURIComponent(`/docs/${doc.slug}`)}">Tell us</a>
              and we will fix it. ${site.contact.responseTime}
            </p>
          </article>

          <div class="stack">
            ${doc.headings.length > 1
              ? html`
                  <nav class="toc" aria-labelledby="doc-toc">
                    <h2 id="doc-toc">On this page</h2>
                    <ul>
                      ${doc.headings.map(
                        (heading) => html`<li><a href="#${heading.id}" data-toc-link>${heading.text}</a></li>`,
                      )}
                    </ul>
                  </nav>
                `
              : ''}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <nav class="split" aria-label="Documentation pages either side of this one">
          <div>
            ${neighbours.previous
              ? html`<a class="btn btn--quiet" href="/docs/${neighbours.previous.slug}"
                  >${icon('arrowLeft')}<span>${neighbours.previous.title}</span></a
                >`
              : ''}
          </div>
          <div>
            ${neighbours.next
              ? html`<a class="btn btn--quiet" href="/docs/${neighbours.next.slug}"
                  ><span>${neighbours.next.title}</span>${icon('arrowRight')}</a
                >`
              : ''}
          </div>
        </nav>
      </div>
    </div>

    ${copyStatusRegion()}
  `;
}

export function docSchema(doc) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: doc.title,
    description: doc.description,
    dateModified: doc.updated,
    inLanguage: site.lang,
    mainEntityOfPage: `${site.origin}/docs/${doc.slug}`,
    publisher: { '@type': 'Organization', name: site.name, url: site.origin },
  };
}

/* --------------------------------------------------------------- blog */

export function blogIndexPage({ tag }) {
  const posts = tag ? allPosts().filter((post) => post.tags.includes(tag)) : allPosts();
  const tags = allTags();

  return html`
    ${pageHeader({
      title: 'Engineering notes',
      lead: 'Things we got wrong, things we changed our minds about, and the reasoning behind decisions that look odd from outside.',
      updated: lastContentUpdate(),
      meta: `${allPosts().length} notes`,
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <div>
            ${tag
              ? html`<p>
                  Showing ${posts.length} ${posts.length === 1 ? 'note' : 'notes'} tagged
                  <strong>${tag}</strong>. <a href="/blog">Show all notes</a>.
                </p>`
              : ''}
            ${posts.length === 0
              ? emptyState({
                  title: 'No notes with that tag',
                  body: 'The tag exists but nothing is filed under it at the moment.',
                  action: html`<a class="btn" href="/blog">Back to all notes</a>`,
                })
              : html`
                  <ul class="post-list">
                    ${posts.map(
                      (post) => html`
                        <li>
                          <p class="post-meta">
                            <time datetime="${post.date}">${formatDate(post.date)}</time> &middot;
                            ${post.readingMinutes} minute read &middot; ${post.author}
                          </p>
                          <h2><a href="/blog/${post.slug}">${post.title}</a></h2>
                          <p>${post.summary || post.description}</p>
                          <p class="text-sm">
                            ${post.tags.map((name) => html`<a class="badge badge--neutral" href="/blog/tag/${name}">${name}</a> `)}
                          </p>
                        </li>
                      `,
                    )}
                  </ul>
                `}
          </div>

          <div class="stack">
            <nav class="panel panel--sunken" aria-labelledby="tags-heading">
              <h2 id="tags-heading">Tags</h2>
              <ul>
                ${tags.map(
                  (entry) => html`<li><a href="/blog/tag/${entry.tag}">${entry.tag}</a> (${entry.count})</li>`,
                )}
              </ul>
            </nav>
            <div class="panel panel--sunken">
              <h2>Subscribe</h2>
              <p class="text-sm">
                There is a feed at <a href="/blog/feed.xml">/blog/feed.xml</a>. There is no email list, because we
                write a few times a year and would rather not hold your address for that.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function blogPostPage({ post, related }) {
  return html`
    ${pageHeader({
      title: post.title,
      lead: post.description,
      updated: post.updated || post.date,
      meta: `${post.readingMinutes} minute read by ${post.author}`,
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <article class="prose">
            <p class="post-meta">
              Published <time datetime="${post.date}">${formatDate(post.date)}</time>
              ${post.updated && post.updated !== post.date
                ? html`, updated <time datetime="${post.updated}">${formatDate(post.updated)}</time>`
                : ''}
              by ${post.author}.
            </p>

            ${raw(post.html)}

            <hr />
            <p class="text-sm">
              Filed under
              ${post.tags.map((tag) => html`<a class="badge badge--neutral" href="/blog/tag/${tag}">${tag}</a> `)}
            </p>
            <p class="text-sm text-muted">
              Disagree with any of this? <a href="/contact?topic=notes">Say so</a>. Corrections get published in the
              <a href="/changelog">changelog</a> and noted at the top of the post.
            </p>
          </article>

          <div class="stack">
            ${post.headings.length > 1
              ? html`
                  <nav class="toc" aria-labelledby="post-toc">
                    <h2 id="post-toc">On this page</h2>
                    <ul>
                      ${post.headings.map(
                        (heading) => html`<li><a href="#${heading.id}" data-toc-link>${heading.text}</a></li>`,
                      )}
                    </ul>
                  </nav>
                `
              : ''}
          </div>
        </div>
      </div>
    </div>

    ${related.length
      ? html`
          <div class="section">
            <div class="container">
              <div class="section__intro"><h2>Related notes</h2></div>
              <div class="grid grid--2">
                ${related.map(
                  (item) => html`
                    <article class="panel">
                      <p class="post-meta"><time datetime="${item.date}">${formatDate(item.date)}</time></p>
                      <h3><a href="/blog/${item.slug}">${item.title}</a></h3>
                      <p>${item.summary || item.description}</p>
                    </article>
                  `,
                )}
              </div>
            </div>
          </div>
        `
      : ''}

    ${copyStatusRegion()}
  `;
}

export function blogSchema(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    inLanguage: site.lang,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: site.name, url: site.origin },
    mainEntityOfPage: `${site.origin}/blog/${post.slug}`,
    keywords: post.tags.join(', '),
  };
}

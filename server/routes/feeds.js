/**
 * Machine-readable endpoints: robots.txt, sitemap.xml, the RSS feed, the
 * OpenSearch description, the web app manifest and security.txt.
 *
 * These are generated from the same data the pages use, so a new document
 * cannot be published and then be missing from the sitemap.
 */
import { site, legal } from '../lib/site.js';
import { allDocs, allPosts, allTags, lastContentUpdate } from '../lib/content.js';

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Pages that should be in the sitemap, with a change frequency we believe. */
function sitemapEntries() {
  const entries = [
    { loc: '/', priority: '1.0', changefreq: 'monthly' },
    { loc: '/how-it-works', priority: '0.9', changefreq: 'monthly' },
    { loc: '/coverage', priority: '0.9', changefreq: 'weekly' },
    { loc: '/pricing', priority: '0.9', changefreq: 'monthly' },
    { loc: '/docs', priority: '0.8', changefreq: 'weekly' },
    { loc: '/blog', priority: '0.8', changefreq: 'monthly' },
    { loc: '/about', priority: '0.7', changefreq: 'yearly' },
    { loc: '/case-study', priority: '0.7', changefreq: 'yearly' },
    { loc: '/contact', priority: '0.7', changefreq: 'yearly' },
    { loc: '/faq', priority: '0.7', changefreq: 'monthly' },
    { loc: '/help', priority: '0.7', changefreq: 'yearly' },
    { loc: '/reviews', priority: '0.6', changefreq: 'monthly' },
    { loc: '/status', priority: '0.5', changefreq: 'daily' },
    { loc: '/changelog', priority: '0.6', changefreq: 'monthly' },
    { loc: '/content-policy', priority: '0.5', changefreq: 'yearly' },
    { loc: '/accessibility', priority: '0.5', changefreq: 'yearly' },
    { loc: '/security', priority: '0.5', changefreq: 'yearly' },
    { loc: '/privacy', priority: '0.5', changefreq: 'yearly' },
    { loc: '/cookies', priority: '0.4', changefreq: 'yearly' },
    { loc: '/terms', priority: '0.4', changefreq: 'yearly' },
    { loc: '/sitemap', priority: '0.3', changefreq: 'monthly' },
    { loc: '/search', priority: '0.3', changefreq: 'yearly' },
  ];

  for (const doc of allDocs()) {
    entries.push({ loc: `/docs/${doc.slug}`, priority: '0.8', changefreq: 'monthly', lastmod: doc.updated });
  }
  for (const post of allPosts()) {
    entries.push({
      loc: `/blog/${post.slug}`,
      priority: '0.6',
      changefreq: 'yearly',
      lastmod: post.updated || post.date,
    });
  }
  for (const entry of allTags()) {
    entries.push({ loc: `/blog/tag/${entry.tag}`, priority: '0.3', changefreq: 'monthly' });
  }
  return entries;
}

export function sitemapXml() {
  const fallback = lastContentUpdate();
  const urls = sitemapEntries()
    .map(
      (entry) => `  <url>
    <loc>${xmlEscape(site.origin + entry.loc)}</loc>
    <lastmod>${entry.lastmod || fallback}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function robotsTxt() {
  return `# ${site.name}
# Everything published here is meant to be read. The only disallowed paths
# are ones that hold a signed-in person's own data or that would waste a
# crawler's time.

User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /login
Disallow: /register
Disallow: /thank-you
Disallow: /api/
Disallow: /search?

Sitemap: ${site.origin}/sitemap.xml
`;
}

export function securityTxt() {
  // Expiry a year out, as the specification requires a future date.
  const expires = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)).toISOString();
  return `Contact: mailto:${site.contact.securityEmail}
Contact: ${site.origin}/security
Expires: ${expires}
Preferred-Languages: en
Canonical: ${site.origin}/.well-known/security.txt
Policy: ${site.origin}/security
`;
}

export function opensearchXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${xmlEscape(site.name)}</ShortName>
  <Description>Search ${xmlEscape(site.name)} documentation and notes</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${xmlEscape(site.origin)}/favicon.ico</Image>
  <Url type="text/html" method="get" template="${xmlEscape(site.origin)}/search?q={searchTerms}"/>
  <moz:SearchForm xmlns:moz="http://www.mozilla.org/2006/browser/search/">${xmlEscape(site.origin)}/search</moz:SearchForm>
</OpenSearchDescription>
`;
}

export function webManifest() {
  return JSON.stringify(
    {
      name: `${site.name}: ${site.tagline}`,
      short_name: site.name,
      description: site.description,
      start_url: '/',
      scope: '/',
      display: 'minimal-ui',
      background_color: '#f7f8f7',
      theme_color: site.themeColor,
      lang: site.lang,
      dir: 'ltr',
      categories: ['utilities', 'productivity'],
      icons: [
        { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/img/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
      shortcuts: [
        { name: 'Check a domain', url: '/coverage' },
        { name: 'Troubleshooting', url: '/docs/troubleshooting' },
      ],
    },
    null,
    2,
  );
}

export function rssFeed() {
  const posts = allPosts();
  const rfc822 = (iso) => new Date(`${iso}T09:00:00Z`).toUTCString();

  const items = posts
    .map(
      (post) => `    <item>
      <title>${xmlEscape(post.title)}</title>
      <link>${xmlEscape(`${site.origin}/blog/${post.slug}`)}</link>
      <guid isPermaLink="true">${xmlEscape(`${site.origin}/blog/${post.slug}`)}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <dc:creator>${xmlEscape(post.author)}</dc:creator>
      <description>${xmlEscape(post.summary || post.description)}</description>
${post.tags.map((tag) => `      <category>${xmlEscape(tag)}</category>`).join('\n')}
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xmlEscape(site.name)} engineering notes</title>
    <link>${xmlEscape(site.origin)}/blog</link>
    <atom:link href="${xmlEscape(site.origin)}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Things we got wrong, things we changed our minds about, and the reasoning behind decisions that look odd from outside.</description>
    <language>en-gb</language>
    <copyright>${legal.year} ${xmlEscape(legal.company)}</copyright>
    <lastBuildDate>${rfc822(posts[0]?.date || lastContentUpdate())}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

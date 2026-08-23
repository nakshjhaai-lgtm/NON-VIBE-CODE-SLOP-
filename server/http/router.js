/**
 * A small pattern router.
 *
 * Routes are declared as `GET /docs/:slug`. Parameters are decoded and
 * validated against a conservative character set, so a path parameter can
 * never smuggle a slash or an encoded traversal into a handler.
 */

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const source = pattern
      .split('/')
      .map((segment) => {
        if (!segment) return '';
        if (segment.startsWith(':')) {
          keys.push(segment.slice(1));
          return '([^/]+)';
        }
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.routes.push({ method, regex: new RegExp(`^${source}/?$`), keys, handler, pattern });
    return this;
  }

  get(pattern, handler) { return this.add('GET', pattern, handler); }
  post(pattern, handler) { return this.add('POST', pattern, handler); }

  /**
   * @returns {{handler: Function, params: object} | null | 'method-mismatch'}
   */
  match(method, pathname) {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method && !(method === 'HEAD' && route.method === 'GET')) continue;

      const params = {};
      let bad = false;
      route.keys.forEach((key, i) => {
        let value;
        try {
          value = decodeURIComponent(m[i + 1]);
        } catch {
          bad = true;
          return;
        }
        if (/[\0/\\]/.test(value)) bad = true;
        params[key] = value;
      });
      if (bad) continue;
      return { handler: route.handler, params, pattern: route.pattern };
    }
    return pathMatched ? 'method-mismatch' : null;
  }

  /** Every registered GET path without parameters, used to build the sitemap. */
  staticGetPaths() {
    return this.routes
      .filter((r) => r.method === 'GET' && r.keys.length === 0)
      .map((r) => r.pattern);
  }
}

/**
 * Sign in, register, and the signed-in dashboard.
 *
 * The dashboard is a real application surface: it reads and writes rows the
 * user owns, and every write goes through an ownership check in SQL.
 */
import { html } from '../../lib/html.js';
import { icon } from '../icons.js';
import { site } from '../../lib/site.js';
import { lists } from '../../lib/blocklists.js';
import {
  pageHeader,
  field,
  passwordField,
  csrfField,
  botTrap,
  errorSummary,
  message,
  emptyState,
  confirmDialog,
  formatDate,
  copyable,
  copyStatusRegion,
  badge,
} from '../components.js';

/* -------------------------------------------------------------- sign in */

export function loginPage({ csrf, values = {}, errors = {}, notice, issuedAt, next }) {
  return html`
    ${pageHeader({
      title: 'Sign in',
      lead: 'An account is only needed for the hosted plan. Everything else on this site works without one.',
    })}

    <div class="section">
      <div class="container">
        <div class="split">
          <div>
            ${notice ? message(notice.kind, notice.text, { title: notice.title || '' }) : ''} ${errorSummary(errors)}

            <form method="post" action="/login" class="stack" novalidate data-validate>
              ${csrfField(csrf)} ${botTrap(issuedAt)}
              ${next ? html`<input type="hidden" name="next" value="${next}" />` : ''}

              ${field({
                name: 'email',
                label: 'Email address',
                type: 'email',
                required: true,
                autocomplete: 'username',
                maxlength: 254,
                value: values.email || '',
                error: errors.email || '',
              })}
              ${passwordField({
                name: 'password',
                label: 'Password',
                autocomplete: 'current-password',
                error: errors.password || '',
              })}

              <div class="btn-row">
                <button type="submit" class="btn btn--primary">${icon('lock')}<span>Sign in</span></button>
                <a class="btn btn--quiet" href="/register">Create an account</a>
              </div>
            </form>
          </div>

          <div class="panel panel--sunken">
            <h2>About signing in</h2>
            <ul class="text-sm">
              <li>Five failed attempts locks the account for fifteen minutes. The message says how long is left.</li>
              <li>The response is the same whether or not the address has an account, so this form cannot be used to find out who is registered.</li>
              <li>Your password is hashed with argon2id and is never stored, logged or emailed in any other form.</li>
              <li>The session cookie is HttpOnly and expires after twelve hours.</li>
            </ul>
            <p class="text-sm">
              Forgotten your password? Email <a href="mailto:${site.contact.supportEmail}">${site.contact.supportEmail}</a>
              from the registered address. There is no self-service reset yet, and pretending otherwise with a link
              that goes nowhere would be worse.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function registerPage({ csrf, values = {}, errors = {}, issuedAt }) {
  return html`
    ${pageHeader({
      title: 'Create an account',
      lead: 'For the hosted plan. Self-hosting needs no account at all.',
    })}

    <div class="section">
      <div class="container">
        <div class="split">
          <div>
            ${errorSummary(errors)}

            <form method="post" action="/register" class="stack" novalidate data-validate>
              ${csrfField(csrf)} ${botTrap(issuedAt)}

              ${field({
                name: 'display_name',
                label: 'Your name',
                required: true,
                autocomplete: 'name',
                maxlength: 80,
                value: values.display_name || '',
                error: errors.display_name || '',
              })}
              ${field({
                name: 'email',
                label: 'Email address',
                type: 'email',
                required: true,
                autocomplete: 'username',
                maxlength: 254,
                value: values.email || '',
                error: errors.email || '',
              })}
              ${passwordField({
                name: 'password',
                label: 'Password',
                autocomplete: 'new-password',
                strength: true,
                error: errors.password || '',
                hint: 'At least twelve characters. Length matters more than punctuation; three unrelated words are stronger than one word with symbols in it.',
              })}

              <div class="field">
                <label class="choice" for="field-terms">
                  <input type="checkbox" id="field-terms" name="terms" value="on" ${values.terms ? 'checked' : ''} />
                  <span>I accept the <a href="/terms">terms of service</a> and the <a href="/privacy">privacy policy</a>.</span>
                </label>
                ${errors.terms ? html`<p class="field__error">${icon('error')}<span>${errors.terms}</span></p>` : ''}
              </div>

              <div class="btn-row">
                <button type="submit" class="btn btn--primary">${icon('plus')}<span>Create account</span></button>
                <a class="btn btn--quiet" href="/login">I already have one</a>
              </div>
            </form>
          </div>

          <div class="panel panel--sunken">
            <h2>What we will hold</h2>
            <ul class="text-sm">
              <li>Your email address, to sign you in and to reply to you.</li>
              <li>The name you enter, shown in the dashboard.</li>
              <li>An argon2id hash of your password.</li>
              <li>Your profile configuration: which lists are on, and any allowlist entries.</li>
            </ul>
            <p class="text-sm">
              Not a record of what your network resolved, because that is not collected. You can export and delete all
              of this yourself from the dashboard. The <a href="/privacy">privacy policy</a> is the full version.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------ dashboard */

const DASH_NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/profiles', label: 'Profiles and lists' },
  { href: '/dashboard/account', label: 'Account and data' },
];

function dashboardShell(currentPath, user, content, csrf) {
  return html`
    <div class="container">
      <div class="app-shell">
        <nav class="app-nav" aria-label="Dashboard sections">
          <ul>
            ${DASH_NAV.map(
              (item) => html`
                <li>
                  <a href="${item.href}" ${item.href === currentPath ? 'aria-current="page"' : ''}>${item.label}</a>
                </li>
              `,
            )}
            <li>
              <form method="post" action="/logout">
                ${csrfField(csrf)}
                <button type="submit" class="btn btn--quiet btn--sm btn--block">${icon('logout')}<span>Sign out</span></button>
              </form>
            </li>
          </ul>
        </nav>
        <div class="stack-lg">
          <div>
            <h1>${user.display_name}</h1>
            <p class="text-muted">Signed in as ${user.email}</p>
          </div>
          ${content}
        </div>
      </div>
    </div>
  `;
}

export function dashboardOverviewPage({ user, profiles, currentPath, notice, csrf }) {
  return html`
    ${dashboardShell(
      currentPath,
      user,
      html`
        ${notice ? message(notice.kind, notice.text, { title: notice.title || '' }) : ''}

        <section>
          <h2>Your resolver addresses</h2>
          <p>
            Point your router or device at these. They are the same for every account; your configuration is matched
            by the network that queries them.
          </p>
          <div class="stack">
            ${copyable('198.51.100.10', { id: 'resolver-v4-1', label: 'Copy' })}
            ${copyable('198.51.100.11', { id: 'resolver-v4-2', label: 'Copy' })}
            ${copyable('2001:db8:2::10', { id: 'resolver-v6-1', label: 'Copy' })}
            ${copyable('2001:db8:2::11', { id: 'resolver-v6-2', label: 'Copy' })}
          </div>
          <p class="text-sm text-muted">
            These are documentation addresses, reserved by the IETF for examples. This deployment is a demonstration
            and does not operate a public resolver, so nothing would answer if you used them. We would rather show
            reserved addresses than invent real ones.
          </p>
        </section>

        <section>
          <h2>Profiles</h2>
          ${profiles.length === 0
            ? emptyState({
                title: 'No profiles yet',
                body: 'A profile is a named set of lists, so different networks or different devices can be filtered differently.',
                action: html`<a class="btn btn--primary" href="/dashboard/profiles">Create one</a>`,
              })
            : html`
                <div class="grid grid--2">
                  ${profiles.map(
                    (profile) => html`
                      <article class="panel">
                        <h3>${profile.label}</h3>
                        <p class="text-sm text-muted">
                          Created <time datetime="${profile.created_at}">${formatDate(String(profile.created_at).slice(0, 10))}</time>
                        </p>
                        <p>
                          ${(profile.lists || '')
                            .split(',')
                            .filter(Boolean)
                            .map((id) => badge('neutral', lists.find((l) => l.id === id)?.name || id))}
                        </p>
                        <p><a href="/dashboard/profiles#profile-${profile.id}">Edit this profile</a></p>
                      </article>
                    `,
                  )}
                </div>
              `}
        </section>

        <section>
          <h2>What is not here</h2>
          <p>
            There is no traffic graph and no list of blocked domains, because query logging is off by default and we
            have nothing to draw. Building this screen without that data was a deliberate choice, and
            <a href="/blog/no-query-logs-by-default">we wrote about what it costs</a>.
          </p>
        </section>
      `,
      csrf,
    )}
    ${copyStatusRegion()}
  `;
}

export function dashboardProfilesPage({ user, profiles, allowEntries, csrf, currentPath, errors = {}, notice }) {
  return html`
    ${dashboardShell(
      currentPath,
      user,
      html`
        ${notice ? message(notice.kind, notice.text, { title: notice.title || '' }) : ''} ${errorSummary(errors)}

        <section>
          <h2>Create a profile</h2>
          <form method="post" action="/dashboard/profiles" class="stack">
            ${csrfField(csrf)}
            ${field({
              name: 'label',
              label: 'Profile name',
              required: true,
              maxlength: 80,
              error: errors.label || '',
              hint: 'For example: home network, or study room.',
            })}
            <fieldset class="field">
              <legend class="field__label">Lists to enable</legend>
              ${lists.map(
                (list) => html`
                  <label class="choice" for="list-${list.id}">
                    <input
                      type="checkbox"
                      id="list-${list.id}"
                      name="lists"
                      value="${list.id}"
                      ${list.id === 'gambling' ? 'checked' : ''}
                    />
                    <span><strong>${list.name}</strong>. ${list.description}</span>
                  </label>
                `,
              )}
            </fieldset>
            <div class="btn-row">
              <button type="submit" class="btn btn--primary">${icon('plus')}<span>Create profile</span></button>
            </div>
          </form>
        </section>

        ${profiles.map(
          (profile) => html`
            <section id="profile-${profile.id}">
              <h2>${profile.label}</h2>

              <form method="post" action="/dashboard/profiles/${profile.id}" class="stack">
                ${csrfField(csrf)}
                <fieldset class="field">
                  <legend class="field__label">Lists</legend>
                  ${lists.map(
                    (list) => html`
                      <label class="choice" for="p-${profile.id}-${list.id}">
                        <input
                          type="checkbox"
                          id="p-${profile.id}-${list.id}"
                          name="lists"
                          value="${list.id}"
                          ${(profile.lists || '').split(',').includes(list.id) ? 'checked' : ''}
                        />
                        <span>${list.name}</span>
                      </label>
                    `,
                  )}
                </fieldset>
                <div class="btn-row">
                  <button type="submit" class="btn btn--primary">${icon('check')}<span>Save lists</span></button>
                </div>
              </form>

              <h3>Allowlist</h3>
              <p class="text-sm text-muted">
                A domain here is resolved normally even if a list would block it. Use it for the false positives that
                a suffix rule inevitably catches.
              </p>

              ${(allowEntries[profile.id] || []).length === 0
                ? emptyState({
                    title: 'Nothing allowlisted',
                    body: 'Every domain is filtered according to the lists above.',
                  })
                : html`
                    <div class="table-wrap">
                      <table>
                        <caption>Allowlisted domains for ${profile.label}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Domain</th>
                            <th scope="col">Note</th>
                            <th scope="col">Added</th>
                            <th scope="col"><span class="visually-hidden">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          ${allowEntries[profile.id].map(
                            (entry) => html`
                              <tr>
                                <th scope="row" class="mono">${entry.domain}</th>
                                <td>${entry.note || ''}</td>
                                <td>
                                  <time datetime="${entry.created_at}">${formatDate(String(entry.created_at).slice(0, 10))}</time>
                                </td>
                                <td>
                                  <form method="post" action="/dashboard/allow/${entry.id}/delete">
                                    ${csrfField(csrf)}
                                    <button
                                      type="submit"
                                      class="btn btn--danger btn--sm"
                                      data-confirm="Remove ${entry.domain} from the allowlist? It will be filtered again straight away."
                                      data-confirm-title="Remove allowlist entry"
                                    >
                                      ${icon('minus')}<span>Remove</span>
                                    </button>
                                  </form>
                                </td>
                              </tr>
                            `,
                          )}
                        </tbody>
                      </table>
                    </div>
                  `}

              <form method="post" action="/dashboard/profiles/${profile.id}/allow" class="stack">
                ${csrfField(csrf)}
                ${field({
                  name: `domain`,
                  label: 'Domain to allow',
                  required: true,
                  maxlength: 253,
                  inputmode: 'url',
                  error: errors.domain || '',
                })}
                ${field({
                  name: `note`,
                  label: 'Why',
                  required: false,
                  maxlength: 120,
                  error: errors.note || '',
                  hint: 'So you remember in six months.',
                })}
                <div class="btn-row">
                  <button type="submit" class="btn">${icon('plus')}<span>Add to allowlist</span></button>
                </div>
              </form>
            </section>
          `,
        )}
      `,
      csrf,
    )}
    ${confirmDialog()}
  `;
}

export function dashboardAccountPage({ user, csrf, currentPath, notice, counts: dataCounts }) {
  return html`
    ${dashboardShell(
      currentPath,
      user,
      html`
        ${notice ? message(notice.kind, notice.text, { title: notice.title || '' }) : ''}

        <section>
          <h2>What we hold about you</h2>
          <div class="table-wrap">
            <table>
              <caption>Every record associated with this account</caption>
              <thead>
                <tr><th scope="col">Record</th><th scope="col" class="numeric">Rows</th><th scope="col">Kept until</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Account</th><td class="numeric">1</td><td>You delete it</td></tr>
                <tr><th scope="row">Active sessions</th><td class="numeric">${dataCounts.sessions}</td><td>12 hours after each sign-in</td></tr>
                <tr><th scope="row">Profiles</th><td class="numeric">${dataCounts.profiles}</td><td>You delete them</td></tr>
                <tr><th scope="row">Allowlist entries</th><td class="numeric">${dataCounts.allowEntries}</td><td>You delete them</td></tr>
                <tr><th scope="row">Resolved-query history</th><td class="numeric">0</td><td>Never collected</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Export</h2>
          <p>Everything above, as JSON, generated when you click. Nothing is stored to produce it.</p>
          <div class="btn-row">
            <a class="btn" href="/dashboard/export.json" download>${icon('download')}<span>Download my data</span></a>
          </div>
        </section>

        <section>
          <h2>Sign out everywhere</h2>
          <p>Ends every session for this account, including this one. Useful if you signed in on a machine you no longer control.</p>
          <form method="post" action="/dashboard/sessions/revoke">
            ${csrfField(csrf)}
            <button
              type="submit"
              class="btn"
              data-confirm="End every session for this account? You will be signed out here as well."
              data-confirm-title="Sign out everywhere"
            >
              ${icon('logout')}<span>Sign out of all sessions</span>
            </button>
          </form>
        </section>

        <section>
          <h2>Delete this account</h2>
          <p>
            Removes the account, its sessions, its profiles and its allowlist entries. This happens immediately and
            cannot be undone; there is no thirty-day grace period and no archived copy.
          </p>
          <form method="post" action="/dashboard/delete" class="stack">
            ${csrfField(csrf)}
            ${field({
              name: 'confirm_email',
              label: 'Type your email address to confirm',
              required: true,
              maxlength: 254,
              autocomplete: 'off',
              hint: 'This is a deliberate speed bump, not a formality.',
            })}
            <div class="btn-row">
              <button
                type="submit"
                class="btn btn--danger"
                data-confirm="Delete this account and everything associated with it? This cannot be undone."
                data-confirm-title="Delete account"
              >
                ${icon('cross')}<span>Delete my account</span>
              </button>
            </div>
          </form>
        </section>
      `,
      csrf,
    )}
    ${confirmDialog()}
  `;
}

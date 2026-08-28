/**
 * Privacy, cookies and terms. Written to be read rather than to be
 * defensible, which mostly means short sentences and no defined terms.
 */
import { html } from '../../lib/html.js';
import { site, legal } from '../../lib/site.js';
import { pageHeader, message } from '../components.js';

const UPDATED = '2026-08-27';

export function privacyPage() {
  return html`
    ${pageHeader({
      title: 'Privacy policy',
      lead: 'Everything this website and this resolver store about you, why, and for how long.',
      updated: UPDATED,
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <div class="prose stack">
            <h2 id="short">The short version</h2>
            <p>
              The resolver does not log your queries. This website stores an account record if you make one, an
              enquiry if you send one, a review if you leave one, and a privacy-preserving page count if you agreed to
              analytics. Service providers process data only to run the site; it is not sold, used for advertising or
              shared for tracking.
            </p>

            <h2 id="controller">Who is responsible</h2>
            <p>
              ${legal.company},
              ${legal.companyNumber === 'Not yet incorporated'
                ? 'which is not yet incorporated and therefore has no company number to give you'
                : `company number ${legal.companyNumber}`},
              at ${site.contact.address.street}, ${site.contact.address.locality}
              ${site.contact.address.postcode}, ${site.contact.address.countryName}. For anything about your data,
              email <a href="mailto:${site.contact.email}">${site.contact.email}</a>.
            </p>

            <h2 id="resolver">What the resolver stores</h2>
            <p>
              Nothing about you, by default. Answers are cached in memory so they can be served quickly; that cache
              holds domain names and their addresses, not who asked. Query logging exists as an option for people
              troubleshooting their own instance, is off unless switched on, and writes to your own disk on a
              self-hosted install.
            </p>
            <p>
              On the hosted plan we hold the network's configuration, which is the lists you enabled and any
              allowlist entries you added. We do not hold a record of resolved names.
            </p>

            <h2 id="website">What this website stores</h2>

            <h3>If you make an account</h3>
            <p>
              Your email address, a display name, and a salted PBKDF2-HMAC-SHA-256 hash of your password. We never
              store the password itself. We also keep the time you last signed in, and one record per active session
              containing a random identifier, an expiry and the browser's user agent string.
            </p>
            <p>Kept until you delete the account, which you can do yourself from the dashboard.</p>

            <h3>If you send an enquiry</h3>
            <p>
              Your name, email address, optional organisation, chosen topic and message, plus a reference so we can
              both refer to it. Kept for twelve months, then deleted.
            </p>

            <h3>If you leave a review</h3>
            <p>
              The display name and role you chose, your rating, the review text, and your email address. The email is
              used once to check the review is genuine, then removed from the record. The rest is published only if
              you gave permission by submitting it, and only after a person has read it.
            </p>

            <h3>If you accept analytics</h3>
            <p>
              A record per page view containing the path, the date, the referring site's hostname, any UTM parameters
              in the URL, and a visitor hash. The hash is SHA-256 of your IP address, user agent, the date, and a
              secret salt, truncated to sixteen characters. It changes every day by design, so it cannot be used to
              follow you across days, and it cannot be reversed to recover your address.
            </p>
            <p>
              Analytics is off until you accept it. If you reject it, no page views are recorded at all. Records older
              than ninety days are deleted.
            </p>

            <h3>Server logs</h3>
            <p>
              The edge application records the method, path, status and duration of each request so faults can be
              diagnosed. General rate-limit counters containing an IP address stay only in an edge isolate's memory
              until their window ends or the isolate is replaced. Failed sign-ins also store a combined email-address
              and IP-address key for up to 24 hours so the fifteen-minute lockout survives isolate replacement; a
              successful sign-in removes that key.
            </p>

            <h2 id="not">What we do not do</h2>
            <ul>
              <li>No advertising, no advertising identifiers, no remarketing.</li>
              <li>No third-party analytics. Nothing on this site loads from another origin; the Content-Security-Policy forbids it.</li>
              <li>No selling of data and no sharing for advertising or tracking. Processors receive only what they need to operate the service.</li>
              <li>No profiling, and no automated decisions about you.</li>
              <li>No international transfer except where a named service provider needs it to deliver the service under contractual safeguards.</li>
            </ul>

            <h2 id="lawful">Lawful bases</h2>
            <ul>
              <li><strong>Contract</strong> for account and hosted-plan data: we cannot provide the service without it.</li>
              <li><strong>Legitimate interests</strong> for enquiries and security logging: answering you, and keeping the service from being abused.</li>
              <li><strong>Consent</strong> for analytics and for publishing a review. Both can be withdrawn.</li>
            </ul>

            <h2 id="rights">Your rights</h2>
            <p>
              Under the UK GDPR you can ask for a copy of your data, ask for it to be corrected, ask for it to be
              deleted, object to processing, or ask us to restrict it. Email
              <a href="mailto:${site.contact.email}">${site.contact.email}</a> and we will respond within one month,
              usually much sooner.
            </p>
            <p>
              Account holders can export and delete their own data from the dashboard without asking us. If you are
              unhappy with how we handled a request you can complain to the Information Commissioner's Office at
              <a href="https://ico.org.uk/" rel="noopener noreferrer">ico.org.uk</a>.
            </p>

            <h2 id="processors">Processors</h2>
            <p>
              Netlify provides this site's content delivery, edge application runtime and persistent Blob storage, and
              is a processor for those purposes. Requests are handled on its global edge network and may be processed
              outside the United Kingdom and European Economic Area under its contractual safeguards. Transactional
              email is sent through a provider in the European Economic Area. We use no third-party analytics, tag
              management or customer messaging service.
            </p>

            <h2 id="changes">Changes</h2>
            <p>
              Material changes are announced in the <a href="/changelog">changelog</a> before they take effect, and
              the date at the top of this page is updated. We do not quietly revise this page.
            </p>
          </div>

          <nav class="toc" aria-labelledby="privacy-toc">
            <h2 id="privacy-toc">On this page</h2>
            <ul>
              <li><a href="#short">The short version</a></li>
              <li><a href="#controller">Who is responsible</a></li>
              <li><a href="#resolver">The resolver</a></li>
              <li><a href="#website">This website</a></li>
              <li><a href="#not">What we do not do</a></li>
              <li><a href="#lawful">Lawful bases</a></li>
              <li><a href="#rights">Your rights</a></li>
              <li><a href="#processors">Processors</a></li>
              <li><a href="#changes">Changes</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  `;
}

export function cookiesPage({ reset = false } = {}) {
  return html`
    ${pageHeader({
      title: 'Cookie policy',
      lead: 'Three cookies, all first-party, none for advertising.',
      updated: UPDATED,
    })}

    <div class="section">
      <div class="container">
        <div class="prose stack" style="max-width: 68ch;">
          ${reset
            ? html`<div data-reset-analytics-choice>
                ${message(
                  'success',
                  'The analytics cookie has been deleted and the banner will appear again on your next page. Nothing was being recorded in the meantime.',
                  { title: 'Choice cleared' },
                )}
              </div>`
            : ''}
          <p>
            This site sets no cookie on ordinary content pages. It sets one when you load a form, sign in, or record
            an analytics choice. There is no third-party cookie, because nothing on this site is loaded from a third party.
          </p>

          <div class="table-wrap">
            <table>
              <caption>Every cookie this site can set</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Lifetime</th>
                  <th scope="col">Set when</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row"><code class="mono">ng_session</code></th>
                  <td>Keeps you signed in. Holds a random identifier and nothing else.</td>
                  <td>12 hours</td>
                  <td>You sign in</td>
                </tr>
                <tr>
                  <th scope="row"><code class="mono">ng_csrf</code></th>
                  <td>Proves a form submission came from this site, preventing cross-site request forgery.</td>
                  <td>Browser session</td>
                  <td>You load a page containing a form</td>
                </tr>
                <tr>
                  <th scope="row"><code class="mono">ng_analytics</code></th>
                  <td>Records your choice about analytics so you are not asked again.</td>
                  <td>6 months</td>
                  <td>You accept or reject in the banner</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            All three are <code class="mono">HttpOnly</code> where the server is the only consumer,
            <code class="mono">Secure</code> when served over HTTPS, and <code class="mono">SameSite=Lax</code>.
          </p>

          <h2>Local storage</h2>
          <p>
            Two values are kept in your browser's local storage rather than in a cookie, because the server has no
            use for them: <code class="mono">ng-theme</code> holds your light or dark preference, and
            <code class="mono">ng-analytics</code> mirrors your analytics choice so the banner does not reappear
            before the page has finished loading. Neither is sent to us.
          </p>

          <h2>Changing your mind</h2>
          <p>
            Rejecting analytics stops the recording immediately and deletes nothing retrospectively, because there is
            nothing identifying to delete. To clear the choice and see the banner again, clear this site's cookies and
            local storage in your browser settings, or
            <a href="/cookies?reset=1">reset it here</a>.
          </p>

          ${message(
            'info',
            html`We do not use a consent management platform, and there is no "legitimate interest" tab hiding
              hundreds of vendors. Reject means nothing is recorded.`,
          )}
        </div>
      </div>
    </div>
  `;
}

export function termsPage() {
  return html`
    ${pageHeader({
      title: 'Terms of service',
      lead: 'What we promise, what we do not, and the limits of what a DNS filter can be held to.',
      updated: UPDATED,
    })}

    <div class="section">
      <div class="container">
        <div class="prose stack" style="max-width: 68ch;">
          <h2>1. Who these terms are with</h2>
          <p>
            ${legal.company}, at ${site.contact.address.street}, ${site.contact.address.locality}
            ${site.contact.address.postcode}. Using this website or the hosted resolver means accepting these terms.
          </p>

          <h2>2. What the service is</h2>
          <p>
            A DNS resolver that declines to resolve domains on lists you enable, and a website describing it. It is a
            filtering tool. It is not a treatment programme, a self-exclusion scheme, or a guarantee of any outcome.
          </p>

          <h2>3. What it explicitly is not</h2>
          <p>
            We do not promise the filter cannot be bypassed, because it can.
            <a href="/docs/limitations">The documented limitations</a> form part of these terms. If you are relying on
            this to protect someone at risk, read that page and register with
            <a href="/help">GAMSTOP</a> as well.
          </p>

          <h2>4. Acceptable use</h2>
          <ul>
            <li>Do not use the hosted resolver to filter a network you do not administer or have permission to administer.</li>
            <li>Do not attempt to overload the service, and do not attempt to access accounts other than your own.</li>
            <li>Security testing within the scope of the <a href="/security">disclosure policy</a> is welcome and is not a breach of these terms.</li>
          </ul>

          <h2>5. Accounts</h2>
          <p>
            You are responsible for keeping your password to yourself. Tell us at once if you think an account has
            been accessed by someone else. We may suspend an account that is being used to abuse the service, and we
            will tell you why.
          </p>

          <h2>6. Payment and cancellation</h2>
          <p>
            The hosted plan is billed monthly in advance. Cancel at any time from the dashboard; the service runs to
            the end of the period you have paid for and is not renewed. There is no minimum term and no cancellation
            fee. If we increase the price we will tell you at least thirty days beforehand.
          </p>

          <h2>7. Availability</h2>
          <p>
            We aim for the hosted resolver to be continuously available and we do not offer a contractual uptime
            guarantee, because two people running a small service cannot honestly back one. Configure a secondary
            resolver. The <a href="/status">status page</a> reports what we can see.
          </p>

          <h2>8. Your data</h2>
          <p>Governed by the <a href="/privacy">privacy policy</a>, which forms part of these terms.</p>

          <h2>9. Liability</h2>
          <p>
            We do not exclude liability for death or personal injury caused by negligence, for fraud, or for anything
            else that cannot lawfully be excluded. Subject to that, our liability is limited to the amount you paid us
            in the twelve months before the claim, and we are not liable for losses arising from gambling that took
            place despite, around, or because of a failure of the filter.
          </p>
          <p>
            This is not us being evasive. A filter that can be turned off from a settings screen cannot carry
            responsibility for what someone does after turning it off.
          </p>

          <h2>10. Ending it</h2>
          <p>
            You may stop using the service at any time. We may end an account for a serious or repeated breach of
            section 4, with notice and with a reason. If we withdraw the hosted service entirely, we will give ninety
            days' notice, refund the unused part of any payment, and the self-hosted version will remain available.
          </p>

          <h2>11. Law</h2>
          <p>
            These terms are governed by the law of England and Wales, and the courts of England and Wales have
            jurisdiction. If you are a consumer, this does not affect your statutory rights.
          </p>

          <h2>12. Changes</h2>
          <p>
            Changes are announced in the <a href="/changelog">changelog</a> at least thirty days before they take
            effect for existing customers.
          </p>
        </div>
      </div>
    </div>
  `;
}

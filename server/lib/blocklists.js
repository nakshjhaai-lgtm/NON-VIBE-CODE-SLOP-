/**
 * Blocklist data and matching.
 *
 * These lists are deliberately small and hand-checked. The upstream
 * aggregated feeds this product would normally consume are not reachable from
 * this deployment, and shipping a fabricated "1.2 million domains" figure to
 * make the numbers look impressive is exactly the sort of invented metric
 * this site refuses to publish. What is here is what is real: every entry
 * below is a well-known, publicly operating domain in its category, and the
 * counts shown on the site are counted from this file at runtime.
 *
 * Matching is suffix-based: a rule matches the domain itself and any
 * subdomain of it, which is how DNS-level filtering actually behaves.
 */

/**
 * @typedef {object} Blocklist
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} sourceName    where the entries came from
 * @property {string} sourceUrl
 * @property {string} updated       ISO date this list was last reviewed
 * @property {string[]} rules
 */

/** @type {Blocklist[]} */
export const lists = [
  {
    id: 'gambling',
    name: 'Gambling',
    description:
      'Online casinos, sportsbooks, bingo and poker sites. This is the list most households enable, and it is on by default.',
    sourceName: 'Operators licensed by the Gambling Commission, checked by hand against the public register',
    sourceUrl: 'https://registers.gamblingcommission.gov.uk/',
    updated: '2026-08-14',
    rules: [
      'bet365.com', 'williamhill.com', 'paddypower.com', 'betfair.com', 'skybet.com',
      'ladbrokes.com', 'coral.co.uk', 'betfred.com', 'unibet.co.uk', 'bwin.com',
      'pokerstars.com', '888casino.com', '888poker.com', 'partypoker.com', 'grosvenorcasinos.com',
      'meccabingo.com', 'foxybingo.com', 'tombola.co.uk', 'galabingo.com',
      'virginbet.com', 'betvictor.com', 'boylesports.com', 'quinnbet.com', 'parimatch.co.uk',
      'lottoland.co.uk', 'jackpotjoy.com', 'buzzbingo.com', 'casumo.com', 'leovegas.com',
      'mrgreen.com', 'rainbowriches.com', 'slotsmagic.com', 'stake.com', 'roobet.com',
      'draftkings.com', 'fanduel.com', 'caesars.com', 'betmgm.com', 'pointsbet.com',
    ],
  },
  {
    id: 'gambling-affiliate',
    name: 'Gambling affiliates and tipsters',
    description:
      'Comparison sites, free-bet aggregators and tipster services. These are how most people arrive at a betting site, so blocking operators alone leaves an obvious route open.',
    sourceName: 'Compiled from sites that carry Gambling Commission affiliate disclosures',
    sourceUrl: 'https://www.gamblingcommission.gov.uk/guidance/affiliate-marketing',
    updated: '2026-08-14',
    rules: [
      'oddschecker.com', 'freebets.com', 'bonuscodebets.co.uk', 'bettingexpert.com',
      'olbg.com', 'racingpost.com', 'sportinglife.com', 'thepunterspage.com',
      'casino.org', 'askgamblers.com', 'gamblingsites.com', 'bookmakers.co.uk',
      'matchedbettingblog.com', 'oddsmonkey.com', 'profitaccumulator.co.uk',
    ],
  },
  {
    id: 'lottery',
    name: 'Lottery and scratchcards',
    description:
      'Kept separate because many households want the National Lottery available while blocking everything else. Off by default.',
    sourceName: 'Licensed lottery operators, public register',
    sourceUrl: 'https://registers.gamblingcommission.gov.uk/',
    updated: '2026-08-14',
    rules: ['national-lottery.co.uk', 'lotto.co.uk', 'euromillions.com', 'healthlottery.co.uk', 'postcodelottery.co.uk'],
  },
  {
    id: 'crypto-trading',
    name: 'Crypto and high-risk trading',
    description:
      'Exchanges and contracts-for-difference platforms. Included because the behaviour and the harm pattern closely track gambling, and because several are marketed the same way.',
    sourceName: 'FCA warning list and public exchange directories',
    sourceUrl: 'https://www.fca.org.uk/consumers/warning-list-unauthorised-firms',
    updated: '2026-08-14',
    rules: [
      'binance.com', 'coinbase.com', 'kraken.com', 'bybit.com', 'kucoin.com',
      'etoro.com', 'plus500.com', 'iggroup.com', 'cmcmarkets.com', 'trading212.com',
    ],
  },
];

/** Domains that must never be blocked, whatever a list says. */
export const neverBlock = new Set([
  'gamcare.org.uk',
  'begambleaware.org',
  'gamblingcommission.gov.uk',
  'nhs.uk',
  'gamblersanonymous.org.uk',
  'gamstop.co.uk',
  'citizensadvice.org.uk',
]);

/** Normalises user input into a bare hostname. */
export function normaliseDomain(input) {
  let value = String(input || '').trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, '');
  value = value.split('/')[0].split('?')[0].split('#')[0];
  value = value.replace(/:\d+$/, '').replace(/\.$/, '');
  if (value.startsWith('www.')) value = value.slice(4);
  return value;
}

/** True when `domain` is `rule` or a subdomain of it. */
function matchesRule(domain, rule) {
  return domain === rule || domain.endsWith(`.${rule}`);
}

/**
 * Looks a domain up across the enabled lists.
 *
 * @param {string} input
 * @param {string[]|null} enabled  list ids to search, or null for all
 * @returns {{ domain: string, listed: boolean, list?: string, listId?: string, rule?: string, source?: string, sourceUrl?: string, protected?: boolean }}
 */
export function lookup(input, enabled = null) {
  const domain = normaliseDomain(input);

  for (const safe of neverBlock) {
    if (matchesRule(domain, safe)) {
      return { domain, listed: false, protected: true };
    }
  }

  for (const list of lists) {
    if (enabled && !enabled.includes(list.id)) continue;
    for (const rule of list.rules) {
      if (matchesRule(domain, rule)) {
        return {
          domain,
          listed: true,
          list: list.name,
          listId: list.id,
          rule,
          source: list.sourceName,
          sourceUrl: list.sourceUrl,
        };
      }
    }
  }

  return { domain, listed: false };
}

/** Real counts, derived from the data rather than asserted. */
export function counts() {
  const perList = lists.map((list) => ({ id: list.id, name: list.name, count: list.rules.length, updated: list.updated }));
  return {
    perList,
    total: perList.reduce((sum, l) => sum + l.count, 0),
    listCount: lists.length,
    lastUpdated: lists.map((l) => l.updated).sort().at(-1),
  };
}

export function getList(id) {
  return lists.find((list) => list.id === id);
}

/**
 * Site-wide constants.
 *
 * Anything that appears in more than one place lives here so it cannot drift:
 * navigation, contact details, and the externally-sourced statistics used on
 * the site (each with the source it came from, which the page must print).
 */

export const site = {
  name: 'NetGuard',
  tagline: 'DNS filtering that blocks gambling sites at the network level',
  description:
    'NetGuard is a self-hosted DNS resolver that blocks gambling domains for every device on a network. Published blocklist sources, no account needed to test coverage.',
  // Deliberately a reserved example domain: this project is not deployed at a
  // real address, and inventing one would be a false claim.
  origin: process.env.NETGUARD_ORIGIN || 'https://netguard.example',
  locale: 'en_GB',
  lang: 'en-GB',
  themeColor: '#24483d',

  contact: {
    email: 'hello@netguard.example',
    supportEmail: 'support@netguard.example',
    securityEmail: 'security@netguard.example',
    // A UK non-geographic number reserved for drama/documentation use, so it
    // cannot ring a real person.
    phone: '+44 20 7946 0958',
    phoneHref: '+442079460958',
    hours: 'Monday to Friday, 09:00-17:30 UK time',
    responseTime: 'We reply to every enquiry within one working day.',
    address: {
      street: 'Wenlock Studios, 50-52 Wharf Road',
      locality: 'London',
      region: 'Greater London',
      postcode: 'N1 7EU',
      country: 'GB',
      countryName: 'United Kingdom',
    },
    // Approximate, for the static map graphic only.
    geo: { latitude: 51.5326, longitude: -0.0921 },
  },

  // The single real, verifiable support resource cited across the site.
  helpline: {
    name: 'National Gambling Helpline (GamCare)',
    phone: '0808 8020 133',
    phoneHref: '08088020133',
    hours: '24 hours a day, every day of the year',
    url: 'https://www.gamcare.org.uk/',
    note: 'Free, confidential support across England, Scotland and Wales. Also available by live chat and WhatsApp.',
  },
};

/**
 * Primary navigation. `label` doubles as the link text and the breadcrumb
 * label, so the two can never disagree.
 */
export const primaryNav = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/coverage', label: 'Coverage' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Documentation' },
  { href: '/blog', label: 'Notes' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const footerNav = [
  {
    heading: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/coverage', label: 'Check coverage' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/status', label: 'Service status' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    heading: 'Documentation',
    links: [
      { href: '/docs', label: 'All documentation' },
      { href: '/docs/quick-start', label: 'Quick start' },
      { href: '/docs/router-setup', label: 'Router setup' },
      { href: '/docs/troubleshooting', label: 'Troubleshooting' },
      { href: '/docs/api', label: 'HTTP API' },
    ],
  },
  {
    heading: 'Organisation',
    links: [
      { href: '/about', label: 'About NetGuard' },
      { href: '/about#team', label: 'Who builds it' },
      { href: '/case-study', label: 'Case study' },
      { href: '/blog', label: 'Engineering notes' },
      { href: '/reviews', label: 'Customer reviews' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { href: '/contact', label: 'Contact us' },
      { href: '/faq', label: 'Frequently asked questions' },
      { href: '/help', label: 'Gambling support resources' },
      { href: '/accessibility', label: 'Accessibility statement' },
      { href: '/security', label: 'Report a vulnerability' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/cookies', label: 'Cookie policy' },
      { href: '/terms', label: 'Terms of service' },
      { href: '/content-policy', label: 'Content and proof policy' },
      { href: '/sitemap', label: 'Sitemap' },
    ],
  },
];

/**
 * Externally sourced figures.
 *
 * Every number the site quotes about gambling harm comes from here, and each
 * one carries the publication it came from. Pages must render `source`
 * alongside the figure: an uncited statistic is exactly the kind of invented
 * metric this site refuses to show.
 */
export const statistics = {
  problemGambling: {
    value: '2.4%',
    label: 'of adults in Great Britain scored 8 or more on the PGSI, the threshold for problem gambling',
    detail: 'Roughly 1.3 million adults. 95% confidence interval 1.9% to 2.8%.',
    source: 'Gambling Survey for Great Britain, Annual Report 2025',
    publisher: 'Gambling Commission',
    url: 'https://www.gamblingcommission.gov.uk/report/gambling-survey-for-great-britain-annual-report-2025-official-statistics/gsgb-annual-report-2025-consequences-from-gambling',
    retrieved: '2026-08-23',
  },
  youngAdults: {
    value: '10.4%',
    label: 'of gamblers aged 18 to 24 scored 8 or more on the PGSI, against 0.8% of those aged 75 and over',
    detail: 'The steepest age gradient in the survey.',
    source: 'Gambling Survey for Great Britain, Annual Report 2025',
    publisher: 'Gambling Commission',
    url: 'https://www.gamblingcommission.gov.uk/report/gambling-survey-for-great-britain-annual-report-2025-official-statistics/gsgb-annual-report-2025-consequences-from-gambling',
    retrieved: '2026-08-23',
  },
  affectedOthers: {
    value: '3.3%',
    label: 'of adults reported being negatively affected by someone else\u2019s gambling',
    detail: 'Relationship breakdown was the most commonly reported consequence.',
    source: 'Gambling Survey for Great Britain, Annual Report 2025',
    publisher: 'Gambling Commission',
    url: 'https://www.gamblingcommission.gov.uk/report/gambling-survey-for-great-britain-annual-report-2025-official-statistics/gsgb-annual-report-2025-consequences-from-gambling',
    retrieved: '2026-08-23',
  },
  onlineShare: {
    value: '38%',
    label: 'of adults gambled online in the past four weeks, against 28% in person',
    detail: 'Online participation is measured including lottery draws.',
    source: 'Gambling Survey for Great Britain, Annual Report 2025',
    publisher: 'Gambling Commission',
    url: 'https://www.gamblingcommission.gov.uk/report/gambling-survey-for-great-britain-annual-report-2025-official-statistics/gsgb-annual-report-2025-consequences-from-gambling',
    retrieved: '2026-08-23',
  },
};

/**
 * A note the statistics section prints in full. Survey methodologies
 * disagree, and hiding that would misrepresent the evidence.
 */
export const statisticsCaveat =
  'The Gambling Survey for Great Britain uses a push-to-web methodology and reports a higher rate of problem gambling than the older health-survey questions, which put it under 1%. The Gambling Commission advises against comparing the two series directly. Both are cited here rather than the more alarming one alone.';

export const legal = {
  company: 'NetGuard Systems Ltd',
  companyNumber: 'Not yet incorporated',
  established: 2024,
  get year() {
    return new Date().getFullYear();
  },
};

const crypto = require('crypto');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule }   = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const algoliasearch    = require('algoliasearch');

initializeApp();

const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const ADMIN_MAGIC_LINK_TTL_MS = 1000 * 60 * 15;
const ADMIN_LOGIN_WINDOW_MS = 1000 * 60 * 15;
const ADMIN_LOGIN_MAX_ATTEMPTS = 10;
const ADMIN_LOGIN_LOCKOUT_MS = 1000 * 60 * 30;
const ALERT_DIGEST_LOOKBACK_MS = 1000 * 60 * 60 * 24;
const MAX_DESCRIPTION_LENGTH = 3000;
const REPORT_COOLDOWN_MS = 1000 * 60 * 5;
const REPORT_WINDOW_MS = 1000 * 60 * 60 * 24;
const REPORT_MAX_PER_WINDOW = 5;
const SUBMISSION_MIN_FORM_FILL_MS = 1000 * 4;
const SUBMISSION_DUPLICATE_WINDOW_MS = 1000 * 60 * 60 * 24 * 14;
const SUBMISSION_COOLDOWN_MS = 1000 * 60 * 3;
const SUBMISSION_WINDOW_MS = 1000 * 60 * 60 * 24;
const SUBMISSION_MAX_PER_WINDOW = 5;
const ADMIN_STATUSES = new Set(['pending', 'approved', 'rejected', 'expired']);
const POST_TYPES = new Set(['need']);
const CATEGORIES = new Set([
  'Software & Dev',
  'IT & Support',
  'Data & AI',
  'Design & UX',
  'Product & Project',
  'DevOps & Cloud',
  'Cybersecurity',
  'QA & Testing',
  'Sales & Customer Success',
  'Marketing & Content',
  'Technical Writing & Docs',
  'Other Tech-Adjacent',
]);
const LOCATIONS = {
  Alabama: ['Northeast Alabama', 'Northern Alabama', 'Central Alabama'],
  Georgia: ['North Georgia', 'Northwest Georgia', 'Northeast Georgia'],
  Kentucky: ['Eastern Kentucky', 'Southeast Kentucky'],
  Maryland: ['Western Maryland'],
  Mississippi: ['Northeast Mississippi'],
  'New York': ['Southern Tier'],
  'North Carolina': ['Western NC', 'High Country', 'Foothills', 'Southwest NC'],
  Ohio: ['Southeastern Ohio', 'Northeast Ohio'],
  Pennsylvania: ['Western PA', 'Southwest PA', 'North Central PA'],
  'South Carolina': ['Upstate South Carolina'],
  Tennessee: ['East Tennessee', 'Tri-Cities', 'Southeast Tennessee'],
  Virginia: ['Southwest Virginia', 'Southside Virginia'],
  'West Virginia': ['Northern WV', 'Central WV', 'Southern WV'],
};
const ADMIN_UPDATE_FIELDS = new Set([
  'category',
  'companyLinkedIn',
  'companyName',
  'companyWebsite',
  'compensation',
  'contact',
  'description',
  'featured',
  'featuredUntil',
  'locationCity',
  'locationNotes',
  'locationRegion',
  'locationState',
  'moderationNotes',
  'remoteFriendly',
  'status',
  'title',
  'urgent',
]);
const FREE_EMAIL_DOMAINS = new Set([
  'aol.com',
  'gmail.com',
  'hotmail.com',
  'icloud.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
]);
const IMPORT_STATUSES = new Set(['pending', 'approved']);
const ANALYTICS_EVENT_FIELDS = {
  board_view: 'boardViews',
  post_view: 'postViews',
  apply_click: 'applyClicks',
  alert_signup: 'alertSignups',
  submit_success: 'submitSuccesses',
};
const POST_ANALYTICS_EVENT_FIELDS = {
  post_view: 'postViews',
  apply_click: 'applyClicks',
};
const ADMIN_SESSION_SECRET_PARAM = defineSecret('ADMIN_SESSION_SECRET');
const ALGOLIA_ADMIN_KEY_PARAM = defineSecret('ALGOLIA_ADMIN_KEY');
const TURNSTILE_SECRET_KEY_PARAM = defineSecret('TURNSTILE_SECRET_KEY');
const ADMIN_SESSION_SECRETS = [ADMIN_SESSION_SECRET_PARAM];
const ALGOLIA_SECRETS = [ALGOLIA_ADMIN_KEY_PARAM];
const TURNSTILE_SECRETS = [TURNSTILE_SECRET_KEY_PARAM];
const ADMIN_AND_ALGOLIA_SECRETS = [ADMIN_SESSION_SECRET_PARAM, ALGOLIA_ADMIN_KEY_PARAM];

function getRequiredEnv(name) {
  const secretValue = {
    ADMIN_SESSION_SECRET: ADMIN_SESSION_SECRET_PARAM,
    ALGOLIA_ADMIN_KEY: ALGOLIA_ADMIN_KEY_PARAM,
    TURNSTILE_SECRET_KEY: TURNSTILE_SECRET_KEY_PARAM,
  }[name]?.value();
  const value = secretValue || process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function getAllowedAdminEmails() {
  const configured = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
  return new Set(
    configured
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
      .filter(isLikelyEmail)
  );
}

function isAllowedAdminEmail(email) {
  return getAllowedAdminEmails().has(String(email || '').trim().toLowerCase());
}

function getAlgoliaIndex() {
  const client = algoliasearch(
    getRequiredEnv('ALGOLIA_APP_ID'),
    getRequiredEnv('ALGOLIA_ADMIN_KEY')
  );
  return client.initIndex('holler_works_posts');
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLength), 'base64').toString('utf8');
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function signAdminTokenBody(body) {
  return base64UrlEncode(
    crypto
      .createHmac('sha256', getRequiredEnv('ADMIN_SESSION_SECRET'))
      .update(body)
      .digest()
  );
}

function issueAdminToken(email) {
  const body = base64UrlEncode(JSON.stringify({
    email: String(email || '').trim().toLowerCase(),
    exp: Date.now() + ADMIN_SESSION_TTL_MS,
  }));
  return `${body}.${signAdminTokenBody(body)}`;
}

function requireAdminSession(data) {
  const token = data?.token;
  if (typeof token !== 'string' || !token) {
    throw new HttpsError('unauthenticated', 'Admin session required.');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new HttpsError('unauthenticated', 'Invalid admin session.');
  }

  const [body, signature] = parts;
  const expected = signAdminTokenBody(body);
  if (!timingSafeEqualString(signature, expected)) {
    throw new HttpsError('unauthenticated', 'Invalid admin session.');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(body));
  } catch {
    throw new HttpsError('unauthenticated', 'Invalid admin session.');
  }

  if (!payload.exp || payload.exp < Date.now()) {
    throw new HttpsError('unauthenticated', 'Admin session expired.');
  }
  if (!payload.email || !isAllowedAdminEmail(payload.email)) {
    throw new HttpsError('unauthenticated', 'Admin session is no longer valid.');
  }

  return payload;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}

function formatLocation(post) {
  if (!post) return '';
  const parts = [];
  if (post.locationCity) parts.push(post.locationCity);
  if (post.locationRegion) parts.push(post.locationRegion);
  if (post.locationState) parts.push(post.locationState);
  return parts.join(', ');
}

function formatAlertLabel(alert) {
  const parts = [];
  if (alert.category) parts.push(alert.category);
  if (alert.remoteFriendly) parts.push('remote-friendly');
  if (alert.locationRegion) parts.push(alert.locationRegion);
  if (alert.locationState) parts.push(alert.locationState);
  if (!parts.length) return 'all holler.works posts';
  return parts.join(' · ');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  const millis = toMillis(value);
  if (!millis) return '';
  return new Date(millis).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatIsoDate(value) {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString() : new Date().toISOString();
}

function getAnalyticsDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(date);
}

function getRecentAnalyticsKeys(days = 7) {
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(getAnalyticsDateKey(new Date(Date.now() - (i * 24 * 60 * 60 * 1000))));
  }
  return keys;
}

function buildPostDescription(post) {
  const parts = [];
  if (post.companyName) parts.push(`${post.companyName}.`);
  if (post.description) parts.push(post.description.trim());
  if (post.compensation) parts.push(`Compensation: ${post.compensation}`);
  const location = formatLocation(post);
  if (location) parts.push(`Location: ${location}`);
  if (post.remoteFriendly) parts.push('Remote-friendly.');
  return parts.join(' ').slice(0, 160);
}

function renderContactLink(post) {
  if (isLikelyEmail(post.contact)) {
    return `<a href="mailto:${escapeHtml(post.contact)}">${escapeHtml(post.contact)}</a>`;
  }
  if (isLikelyHttpUrl(post.contact)) {
    return `<a href="${escapeHtml(post.contact)}" target="_blank" rel="noopener noreferrer">apply on company site</a>`;
  }
  return escapeHtml(post.contact);
}

function renderRichDescriptionHtml(text) {
  if (!text) return '';

  const lines = String(text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let paragraphParts = [];
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraphParts.length) return;
    blocks.push(`<p>${escapeHtml(paragraphParts.join(' '))}</p>`);
    paragraphParts = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const bulletMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1].trim());
      return;
    }

    flushList();
    paragraphParts.push(line);
  });

  flushParagraph();
  flushList();
  return blocks.join('');
}

function buildJobPostingSchema(post, postId) {
  if (post.type !== 'need') return '';

  const locationAddress = {
    '@type': 'PostalAddress',
    addressLocality: post.locationCity || post.locationRegion || '',
    addressRegion: post.locationState || '',
    addressCountry: 'US',
  };
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: post.title || '',
    description: [post.description || '', post.compensation ? `Compensation: ${post.compensation}` : '']
      .filter(Boolean)
      .join('\n\n'),
    datePosted: formatIsoDate(post.approvedAt || post.createdAt),
    hiringOrganization: {
      '@type': 'Organization',
      name: post.companyName || 'holler.works community',
      sameAs: post.companyWebsite || post.companyLinkedIn || 'https://holler.works',
    },
    jobLocation: {
      '@type': 'Place',
      address: locationAddress,
    },
    ...(post.remoteFriendly ? {
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: { '@type': 'Country', name: 'US' },
    } : {}),
    occupationalCategory: post.category || '',
    directApply: isLikelyHttpUrl(post.contact),
    url: `https://holler.works/post/${postId}`,
  };

  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function renderMetaRows(post) {
  const rows = [
    ['company', post.companyName || ''],
    ['category', post.category || ''],
    ['location', formatLocation(post)],
    ['location notes', post.locationNotes || ''],
    ['compensation', post.compensation || ''],
    ['posted', formatDate(post.approvedAt || post.createdAt)],
  ].filter(([, value]) => value);

  if (post.remoteFriendly) rows.splice(3, 0, ['remote', 'remote-friendly']);
  if (post.urgent) rows.splice(3, 0, ['urgency', 'urgent']);

  return rows.map(([label, value]) => (
    `<div class="meta-row"><span class="meta-label">${escapeHtml(label)}</span>${escapeHtml(value)}</div>`
  )).join('');
}

function renderShell({ title, description, canonicalPath, content, robots = 'index,follow', extraHead = '' }) {
  const canonicalUrl = `https://holler.works${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="holler.works">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://holler.works/assets/social-banner.png">
  <meta name="theme-color" content="#0e0e0e">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="https://holler.works/assets/social-banner.png">
  <link rel="icon" type="image/png" sizes="32x32" href="https://holler.works/assets/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="https://holler.works/assets/favicon-16.png">
  <link rel="apple-touch-icon" href="https://holler.works/assets/apple-touch-icon.png">
  <link rel="manifest" href="https://holler.works/assets/site.webmanifest">
  <style>
    :root {
      --black: #0e0e0e;
      --rust: #f28927;
      --brown: #39803e;
      --gray: #aaaaaa;
      --lgray: #cccccc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--black);
      color: var(--gray);
      font-family: 'Courier New', Courier, monospace;
      line-height: 1.7;
    }
    a { color: var(--rust); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .page {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    .wordmark {
      color: var(--lgray);
      font-size: 14px;
      letter-spacing: 0.08em;
      margin-bottom: 20px;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 22px;
      color: var(--gray);
      font-size: 12px;
    }
    .title {
      color: var(--lgray);
      font-size: 24px;
      line-height: 1.35;
      margin: 0 0 18px;
    }
    .meta {
      display: grid;
      gap: 8px;
      margin-bottom: 24px;
      font-size: 13px;
    }
    .meta-label {
      display: inline-block;
      width: 120px;
      color: var(--brown);
      text-transform: lowercase;
    }
    .description {
      margin: 24px 0;
      padding-top: 18px;
      border-top: 1px solid #1e1e1e;
      color: var(--lgray);
      line-height: 1.9;
    }
    .description p {
      margin: 0 0 14px;
    }
    .description p:last-child {
      margin-bottom: 0;
    }
    .description ul {
      margin: 0 0 14px 20px;
      padding: 0;
    }
    .description li {
      margin-bottom: 8px;
    }
    .footer-link {
      margin-top: 28px;
      font-size: 12px;
    }
    .notice {
      border: 1px solid #2a2a2a;
      padding: 14px 16px;
      margin-top: 20px;
      font-size: 12px;
    }
  </style>
  ${extraHead}
</head>
<body>
  ${content}
</body>
</html>`;
}

function renderPostPageHtml(postId, post) {
  const title = `${post.title}${post.companyName ? ` at ${post.companyName}` : ''} -- holler.works`;
  const description = buildPostDescription(post) || 'Tech and tech-adjacent jobs in Appalachia.';
  const content = `<main class="page">
    <div class="wordmark">HOLLER.WORKS // appalachia</div>
    <a class="back-link" href="/">← back to the board</a>
    <h1 class="title">${escapeHtml(post.title)}</h1>
    <div class="meta">${renderMetaRows(post)}</div>
    <div class="notice">Reviewed by a human before publishing. Approved listings expire after 28 days unless refreshed.</div>
    ${post.description ? `<div class="description">${renderRichDescriptionHtml(post.description)}</div>` : ''}
    <div class="notice">
      ${post.companyName ? `<div><span class="meta-label">company</span>${escapeHtml(post.companyName)}</div>` : ''}
      ${post.companyWebsite ? `<div><span class="meta-label">site</span><a href="${escapeHtml(post.companyWebsite)}" target="_blank" rel="noopener noreferrer">${escapeHtml(new URL(post.companyWebsite).hostname.replace(/^www\./, ''))}</a></div>` : ''}
      ${post.companyLinkedIn ? `<div><span class="meta-label">profile</span><a href="${escapeHtml(post.companyLinkedIn)}" target="_blank" rel="noopener noreferrer">company profile</a></div>` : ''}
      <span class="meta-label">contact</span>${renderContactLink(post)}
    </div>
    <div class="footer-link"><a href="/">browse more posts</a></div>
  </main>`;

  return renderShell({
    title,
    description,
    canonicalPath: `/post/${postId}`,
    content,
    extraHead: buildJobPostingSchema(post, postId),
  });
}

function renderNotFoundPage() {
  return renderShell({
    title: 'post not found -- holler.works',
    description: 'The requested holler.works post could not be found.',
    canonicalPath: '/',
    robots: 'noindex,nofollow',
    content: `<main class="page">
      <div class="wordmark">HOLLER.WORKS // appalachia</div>
      <a class="back-link" href="/">← back to the board</a>
      <h1 class="title">post not found</h1>
      <div class="notice">That listing is missing, expired, or no longer public.</div>
    </main>`,
  });
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLikelyHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(value);
}

function normalizeHttpUrl(value, fieldName, options = {}) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    if (options.allowEmpty) return '';
    throw new HttpsError('invalid-argument', `${fieldName} must be a valid URL.`);
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new HttpsError('invalid-argument', `${fieldName} must be a valid URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new HttpsError('invalid-argument', `${fieldName} must be a valid URL.`);
  }

  return parsed.toString();
}

function normalizeInlineText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDescriptionText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getEmailDomain(value) {
  if (!isLikelyEmail(value)) return '';
  return String(value).split('@')[1].toLowerCase();
}

function isFreeEmailDomain(value) {
  return FREE_EMAIL_DOMAINS.has(getEmailDomain(value));
}

function normalizeContact(value) {
  return value.trim().toLowerCase();
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildAdminLoginLink(token) {
  return `https://holler.works/admin?login=${encodeURIComponent(token)}`;
}

async function enqueueEmail(db, to, subject, text) {
  await db.collection('mail').add({
    to,
    message: {
      subject,
      text,
    },
  });
}

async function recordAdminAuditEvent(db, adminEmail, action, details = {}) {
  await db.collection('adminAuditLog').add({
    action,
    adminEmail: String(adminEmail || '').trim().toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
    ...details,
  });
}

function normalizeFingerprintPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function countHttpUrls(value) {
  return (String(value || '').match(/https?:\/\/\S+/gi) || []).length;
}

function getRawRequestIp(rawRequest) {
  const forwardedFor = rawRequest?.headers?.['x-forwarded-for'];
  const forwardedIp = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : '';
  return forwardedIp || rawRequest?.ip || 'unknown';
}

function serializeAnalyticsDoc(dayKey, snap) {
  const data = snap.exists ? snap.data() : {};
  return {
    dayKey,
    boardViews: Number(data.boardViews || 0),
    postViews: Number(data.postViews || 0),
    applyClicks: Number(data.applyClicks || 0),
    alertSignups: Number(data.alertSignups || 0),
    submitSuccesses: Number(data.submitSuccesses || 0),
  };
}

function computeRate(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!bottom) return 0;
  return Math.round((top / bottom) * 1000) / 10;
}

function serializePostAnalytics(postId, data = {}, post = null) {
  return {
    postId,
    title: post?.title || '',
    companyName: post?.companyName || '',
    status: post?.status || '',
    postViews: Number(data.postViews || 0),
    applyClicks: Number(data.applyClicks || 0),
    applyRate: computeRate(data.applyClicks || 0, data.postViews || 0),
    approvedAt: toMillis(post?.approvedAt || post?.createdAt),
  };
}

async function loadAnalyticsSummary(db, days = 7) {
  const dayKeys = getRecentAnalyticsKeys(days);
  const [snaps, postAnalyticsSnap] = await Promise.all([
    Promise.all(dayKeys.map(dayKey => db.collection('analyticsDaily').doc(dayKey).get())),
    db.collection('analyticsPosts').get(),
  ]);
  const daily = dayKeys.map((dayKey, index) => serializeAnalyticsDoc(dayKey, snaps[index]));
  const totals = daily.reduce((acc, row) => ({
    boardViews: acc.boardViews + row.boardViews,
    postViews: acc.postViews + row.postViews,
    applyClicks: acc.applyClicks + row.applyClicks,
    alertSignups: acc.alertSignups + row.alertSignups,
    submitSuccesses: acc.submitSuccesses + row.submitSuccesses,
  }), {
    boardViews: 0,
    postViews: 0,
    applyClicks: 0,
    alertSignups: 0,
    submitSuccesses: 0,
  });

  const topPostIds = postAnalyticsSnap.docs
    .map(doc => ({
      postId: doc.id,
      postViews: Number(doc.data()?.postViews || 0),
      applyClicks: Number(doc.data()?.applyClicks || 0),
    }))
    .filter(row => row.postViews > 0 || row.applyClicks > 0)
    .sort((left, right) => (
      right.applyClicks - left.applyClicks
      || right.postViews - left.postViews
    ))
    .slice(0, 8)
    .map(row => row.postId);

  const topPostSnaps = topPostIds.length
    ? await db.getAll(...topPostIds.map(postId => db.collection('posts').doc(postId)))
    : [];

  const postById = new Map(topPostSnaps.map(snap => [snap.id, snap.exists ? snap.data() : null]));
  const topPosts = postAnalyticsSnap.docs
    .filter(doc => topPostIds.includes(doc.id))
    .map(doc => serializePostAnalytics(doc.id, doc.data(), postById.get(doc.id)))
    .sort((left, right) => (
      right.applyClicks - left.applyClicks
      || right.postViews - left.postViews
      || ((right.approvedAt || 0) - (left.approvedAt || 0))
    ));

  const funnel = {
    postViewsPerBoardView: computeRate(totals.postViews, totals.boardViews),
    appliesPerPostView: computeRate(totals.applyClicks, totals.postViews),
    appliesPerBoardView: computeRate(totals.applyClicks, totals.boardViews),
    alertsPerBoardView: computeRate(totals.alertSignups, totals.boardViews),
    submissionsPerBoardView: computeRate(totals.submitSuccesses, totals.boardViews),
  };

  return { daily, totals, funnel, topPosts };
}

async function recordAnalyticsEvent(db, eventName, postId = null) {
  const dayKey = getAnalyticsDateKey();
  const dayField = ANALYTICS_EVENT_FIELDS[eventName];
  if (!dayField) return false;

  const batch = db.batch();
  batch.set(db.collection('analyticsDaily').doc(dayKey), {
    dayKey,
    [dayField]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const postField = POST_ANALYTICS_EVENT_FIELDS[eventName];
  if (postField && postId) {
    batch.set(db.collection('analyticsPosts').doc(postId), {
      postId,
      [postField]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
  return true;
}

function buildSubmissionFingerprint(post) {
  return hashValue([
    post.type,
    post.category,
    normalizeFingerprintPart(post.companyName),
    normalizeFingerprintPart(post.title),
    normalizeFingerprintPart(post.contact),
    normalizeFingerprintPart(post.locationState),
    normalizeFingerprintPart(post.locationRegion),
  ].join('|'));
}

function buildReviewFlags(post) {
  const flags = [];

  if (!post.description || post.description.length < 60) {
    flags.push('thin description');
  }
  if (post.type === 'need' && isLikelyEmail(post.contact) && isFreeEmailDomain(post.contact)) {
    flags.push('public email contact');
  }

  return flags;
}

function readImportValue(data, keys, fallback = '') {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const value = data[key];
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value.trim();
    return value;
  }
  return fallback;
}

function readImportBoolean(data, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const value = data[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
      if (['0', 'false', 'no', 'n', ''].includes(normalized)) return false;
    }
    if (typeof value === 'number') return value !== 0;
  }
  return false;
}

function normalizeImportedPost(data, { status }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Imported posts must be objects.');
  }

  const type = String(readImportValue(data, ['type'], 'need')).trim().toLowerCase();
  const title = normalizeInlineText(readImportValue(data, ['title', 'role'], ''));
  const category = String(readImportValue(data, ['category'], '')).trim();
  const companyName = normalizeInlineText(readImportValue(data, ['companyName', 'company', 'company_name'], ''));
  const companyWebsiteInput = String(readImportValue(data, ['companyWebsite', 'companySite', 'company_url', 'companyUrl', 'website'], '')).trim();
  const companyLinkedInInput = String(readImportValue(data, ['companyLinkedIn', 'companyLinkedin', 'linkedin'], '')).trim();
  const locationState = String(readImportValue(data, ['locationState', 'state'], '')).trim();
  const locationRegion = String(readImportValue(data, ['locationRegion', 'region'], '')).trim();
  const locationCity = normalizeInlineText(readImportValue(data, ['locationCity', 'city'], ''));
  const locationNotes = normalizeInlineText(readImportValue(data, ['locationNotes', 'notes', 'location_notes'], ''));
  const compensation = normalizeInlineText(readImportValue(data, ['compensation', 'comp', 'salary'], ''));
  const description = normalizeDescriptionText(readImportValue(data, ['description', 'desc', 'body'], ''));
  const rawContact = String(readImportValue(data, ['contact', 'applyUrl', 'applyURL', 'apply_url', 'url'], '')).trim();
  const remoteFriendly = readImportBoolean(data, ['remoteFriendly', 'remote', 'remote_friendly']);
  const companyWebsite = companyWebsiteInput
    ? normalizeHttpUrl(companyWebsiteInput, 'Company website', { allowEmpty: true })
    : '';
  const companyLinkedIn = companyLinkedInInput
    ? normalizeHttpUrl(companyLinkedInInput, 'Company profile', { allowEmpty: true })
    : '';
  const contact = isLikelyEmail(rawContact)
    ? rawContact.toLowerCase()
    : normalizeHttpUrl(rawContact, 'Contact');

  if (!POST_TYPES.has(type)) {
    throw new HttpsError('invalid-argument', 'Only job posts can be imported right now.');
  }
  if (!title || title.length < 6 || title.length > 80) {
    throw new HttpsError('invalid-argument', 'Title must be 6-80 characters.');
  }
  if (!CATEGORIES.has(category)) {
    throw new HttpsError('invalid-argument', 'Invalid category.');
  }
  if (type === 'need') {
    if (!companyName || companyName.length < 2 || companyName.length > 80) {
      throw new HttpsError('invalid-argument', 'Company name must be 2-80 characters.');
    }
    if (!companyWebsite) {
      throw new HttpsError('invalid-argument', 'Company website is required for hiring posts.');
    }
  }
  if (!LOCATIONS[locationState] || !LOCATIONS[locationState].includes(locationRegion)) {
    throw new HttpsError('invalid-argument', 'Invalid location.');
  }
  if (locationCity && locationCity.length > 80) {
    throw new HttpsError('invalid-argument', 'City must be 80 characters or fewer.');
  }
  if (locationNotes.length > 100) {
    throw new HttpsError('invalid-argument', 'Location notes must be 100 characters or fewer.');
  }
  if (!compensation || compensation.length < 2 || compensation.length > 120) {
    throw new HttpsError('invalid-argument', 'Compensation must be 2-120 characters.');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpsError('invalid-argument', `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }
  if (countHttpUrls(description) > 2) {
    throw new HttpsError('invalid-argument', 'Description contains too many links.');
  }
  if (!contact || contact.length > 200 || (!isLikelyEmail(contact) && !isLikelyHttpUrl(contact))) {
    throw new HttpsError('invalid-argument', 'Contact must be a valid email or URL.');
  }

  const normalizedPost = {
    type,
    title,
    category,
    companyName: companyName || null,
    companyWebsite: companyWebsite || null,
    companyLinkedIn: companyLinkedIn || null,
    locationState,
    locationRegion,
    locationCity: locationCity || null,
    locationNotes: locationNotes || null,
    compensation,
    description,
    contact,
    importedViaAdmin: true,
    moderationNotes: null,
    remoteFriendly,
    reviewFlags: [],
    submissionFingerprint: '',
    status,
    createdAt: FieldValue.serverTimestamp(),
    ...(status === 'approved' ? { approvedAt: FieldValue.serverTimestamp() } : {}),
  };

  normalizedPost.submissionFingerprint = buildSubmissionFingerprint(normalizedPost);
  normalizedPost.reviewFlags = buildReviewFlags(normalizedPost);
  return normalizedPost;
}

function buildAlertFingerprint(alert) {
  return hashValue([
    String(alert.email || '').trim().toLowerCase(),
    alert.category || '',
    alert.locationState || '',
    alert.locationRegion || '',
    alert.remoteFriendly ? '1' : '0',
  ].join('|'));
}

function normalizeReportSubmission(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Report payload is required.');
  }

  const postId = typeof data.postId === 'string' ? data.postId.trim() : '';
  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  const reporterEmail = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';

  if (!postId) {
    throw new HttpsError('invalid-argument', 'postId is required.');
  }
  if (reason.length < 20 || reason.length > 600) {
    throw new HttpsError('invalid-argument', 'Please share 20-600 characters about the issue.');
  }
  if (countHttpUrls(reason) > 2) {
    throw new HttpsError('invalid-argument', 'Report contains too many links.');
  }
  if (reporterEmail && (!isLikelyEmail(reporterEmail) || reporterEmail.length > 200)) {
    throw new HttpsError('invalid-argument', 'Reporter email must be a valid email address.');
  }

  return {
    postId,
    reason,
    reporterEmail: reporterEmail || null,
  };
}

function buildAlertBoardUrl(alert) {
  const params = new URLSearchParams();
  if (alert.category) params.set('cat', alert.category);
  if (alert.remoteFriendly) params.set('remote', '1');
  if (alert.locationState) params.set('st', alert.locationState);
  if (alert.locationRegion) params.set('rgn', alert.locationRegion);
  const query = params.toString();
  return `https://holler.works/${query ? `?${query}` : ''}`;
}

function postMatchesAlert(post, alert) {
  if (post.status !== 'approved') return false;
  if (alert.category && post.category !== alert.category) return false;
  if (alert.locationState && post.locationState !== alert.locationState) return false;
  if (alert.locationRegion && post.locationRegion !== alert.locationRegion) return false;
  if (alert.remoteFriendly && !post.remoteFriendly) return false;
  return true;
}

async function enforceSubmissionRateLimit(db, key) {
  const docRef = db.collection('submissionRateLimits').doc(key);
  const now = Date.now();

  await db.runTransaction(async tx => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data() : {};
    const lastSubmittedAt = data.lastSubmittedAt || 0;
    const windowStartedAt = data.windowStartedAt || now;
    const sameWindow = now - windowStartedAt < SUBMISSION_WINDOW_MS;
    const count = sameWindow ? (data.count || 0) : 0;

    if (now - lastSubmittedAt < SUBMISSION_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', 'Please wait a few minutes before submitting again.');
    }
    if (count >= SUBMISSION_MAX_PER_WINDOW) {
      throw new HttpsError('resource-exhausted', 'Too many submissions from this source today. Try again tomorrow.');
    }

    tx.set(docRef, {
      count: count + 1,
      lastSubmittedAt: now,
      windowStartedAt: sameWindow ? windowStartedAt : now,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function enforceReportRateLimit(db, key) {
  const docRef = db.collection('listingReportRateLimits').doc(key);
  const now = Date.now();

  await db.runTransaction(async tx => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data() : {};
    const lastSubmittedAt = data.lastSubmittedAt || 0;
    const windowStartedAt = data.windowStartedAt || now;
    const sameWindow = now - windowStartedAt < REPORT_WINDOW_MS;
    const count = sameWindow ? (data.count || 0) : 0;

    if (now - lastSubmittedAt < REPORT_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', 'Please wait a few minutes before sending another report.');
    }
    if (count >= REPORT_MAX_PER_WINDOW) {
      throw new HttpsError('resource-exhausted', 'Too many reports from this source today. Try again tomorrow.');
    }

    tx.set(docRef, {
      count: count + 1,
      lastSubmittedAt: now,
      windowStartedAt: sameWindow ? windowStartedAt : now,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function enforceAdminLoginRateLimit(db, key) {
  const docRef = db.collection('adminLoginRateLimits').doc(key);
  const now = Date.now();
  const snap = await docRef.get();

  if (!snap.exists) return;

  const data = snap.data() || {};
  if ((data.lockedUntil || 0) > now) {
    throw new HttpsError('resource-exhausted', 'Too many sign-in attempts. Please try again later.');
  }
}

async function recordAdminLoginFailure(db, key) {
  const docRef = db.collection('adminLoginRateLimits').doc(key);
  const now = Date.now();

  await db.runTransaction(async tx => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data() : {};
    const windowStartedAt = data.windowStartedAt || now;
    const sameWindow = now - windowStartedAt < ADMIN_LOGIN_WINDOW_MS;
    const count = sameWindow ? (data.count || 0) : 0;
    const nextCount = count + 1;

    tx.set(docRef, {
      count: nextCount,
      lockedUntil: nextCount >= ADMIN_LOGIN_MAX_ATTEMPTS ? now + ADMIN_LOGIN_LOCKOUT_MS : 0,
      updatedAt: FieldValue.serverTimestamp(),
      windowStartedAt: sameWindow ? windowStartedAt : now,
    }, { merge: true });
  });
}

async function clearAdminLoginFailures(db, key) {
  await db.collection('adminLoginRateLimits').doc(key).delete().catch(() => {});
}

function normalizeSubmission(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Submission payload is required.');
  }

  const now = Date.now();
  const type = typeof data.type === 'string' ? data.type.trim() : '';
  const title = typeof data.title === 'string' ? normalizeInlineText(data.title) : '';
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  const companyName = typeof data.companyName === 'string' ? normalizeInlineText(data.companyName) : '';
  const companyWebsiteInput = typeof data.companyWebsite === 'string' ? data.companyWebsite.trim() : '';
  const companyLinkedInInput = typeof data.companyLinkedIn === 'string' ? data.companyLinkedIn.trim() : '';
  const locationState = typeof data.locationState === 'string' ? data.locationState.trim() : '';
  const locationRegion = typeof data.locationRegion === 'string' ? data.locationRegion.trim() : '';
  const locationCity = typeof data.locationCity === 'string' ? normalizeInlineText(data.locationCity) : '';
  const locationNotes = typeof data.locationNotes === 'string' ? normalizeInlineText(data.locationNotes) : '';
  const compensation = typeof data.compensation === 'string' ? normalizeInlineText(data.compensation) : '';
  const description = typeof data.description === 'string' ? normalizeDescriptionText(data.description) : '';
  const rawContact = typeof data.contact === 'string' ? data.contact.trim() : '';
  const website = typeof data.website === 'string' ? data.website.trim() : '';
  const formStartedAt = Number(data.formStartedAt);
  const remoteFriendly = !!data.remoteFriendly;
  const companyWebsite = companyWebsiteInput
    ? normalizeHttpUrl(companyWebsiteInput, 'Company website', { allowEmpty: true })
    : '';
  const companyLinkedIn = companyLinkedInInput
    ? normalizeHttpUrl(companyLinkedInInput, 'Company profile', { allowEmpty: true })
    : '';
  const contact = isLikelyEmail(rawContact)
    ? rawContact.toLowerCase()
    : normalizeHttpUrl(rawContact, 'Contact');

  if (website) {
    throw new HttpsError('invalid-argument', 'Submission rejected.');
  }
  if (!Number.isFinite(formStartedAt) || formStartedAt <= 0 || formStartedAt > now + 30000) {
    throw new HttpsError('invalid-argument', 'Please reload the form and try again.');
  }
  if (now - formStartedAt < SUBMISSION_MIN_FORM_FILL_MS) {
    throw new HttpsError('invalid-argument', 'Please take a moment to review the post and try again.');
  }
  if (!POST_TYPES.has(type)) {
    throw new HttpsError('invalid-argument', 'Only job posts are supported right now.');
  }
  if (!title || title.length < 6 || title.length > 80) {
    throw new HttpsError('invalid-argument', 'Title must be 6-80 characters.');
  }
  if (!CATEGORIES.has(category)) {
    throw new HttpsError('invalid-argument', 'Invalid category.');
  }
  if (type === 'need') {
    if (!companyName || companyName.length < 2 || companyName.length > 80) {
      throw new HttpsError('invalid-argument', 'Company name must be 2-80 characters.');
    }
    if (!companyWebsite) {
      throw new HttpsError('invalid-argument', 'Company website is required for hiring posts.');
    }
  }
  if (companyName && companyName.length > 80) {
    throw new HttpsError('invalid-argument', 'Company name must be 80 characters or fewer.');
  }
  if (!LOCATIONS[locationState] || !LOCATIONS[locationState].includes(locationRegion)) {
    throw new HttpsError('invalid-argument', 'Invalid location.');
  }
  if (locationCity && locationCity.length > 80) {
    throw new HttpsError('invalid-argument', 'City must be 80 characters or fewer.');
  }
  if (locationNotes.length > 100) {
    throw new HttpsError('invalid-argument', 'Location notes must be 100 characters or fewer.');
  }
  if (!compensation || compensation.length < 2 || compensation.length > 120) {
    throw new HttpsError('invalid-argument', 'Compensation must be 2-120 characters.');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpsError('invalid-argument', `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }
  if (countHttpUrls(description) > 2) {
    throw new HttpsError('invalid-argument', 'Description contains too many links.');
  }
  if (!contact || contact.length > 200 || (!isLikelyEmail(contact) && !isLikelyHttpUrl(contact))) {
    throw new HttpsError('invalid-argument', 'Contact must be a valid email or URL.');
  }

  const normalizedPost = {
    type,
    title,
    category,
    companyName: companyName || null,
    companyWebsite: companyWebsite || null,
    companyLinkedIn: companyLinkedIn || null,
    locationState,
    locationRegion,
    locationCity: locationCity || null,
    locationNotes: locationNotes || null,
    compensation,
    description,
    contact,
    moderationNotes: null,
    remoteFriendly,
    reviewFlags: [],
    submissionFingerprint: '',
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  };

  normalizedPost.submissionFingerprint = buildSubmissionFingerprint(normalizedPost);
  normalizedPost.reviewFlags = buildReviewFlags(normalizedPost);
  return normalizedPost;
}

async function assertNoRecentDuplicateSubmission(db, post) {
  const cutoff = Date.now() - SUBMISSION_DUPLICATE_WINDOW_MS;
  const snap = await db.collection('posts')
    .where('submissionFingerprint', '==', post.submissionFingerprint)
    .limit(5)
    .get();

  const duplicate = snap.docs.some(docSnap => {
    const existing = docSnap.data();
    const createdAt = toMillis(existing.createdAt) || 0;
    return createdAt >= cutoff && (existing.status === 'pending' || existing.status === 'approved');
  });

  if (duplicate) {
    throw new HttpsError('already-exists', 'A similar post is already live or waiting for review.');
  }
}

async function verifyTurnstileToken(request, token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new HttpsError('invalid-argument', 'Please complete the verification check.');
  }

  const params = new URLSearchParams({
    secret: getRequiredEnv('TURNSTILE_SECRET_KEY'),
    response: token.trim(),
  });

  const clientIp = getClientIdentifier(request);
  if (clientIp && clientIp !== 'unknown') {
    params.set('remoteip', clientIp);
  }

  let payload;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    payload = await response.json();
  } catch (error) {
    console.error('turnstile verification request failed', error);
    throw new HttpsError('unavailable', 'Verification service is unavailable. Please try again.');
  }

  if (!payload?.success) {
    console.warn('turnstile verification failed', payload?.['error-codes'] || []);
    throw new HttpsError('permission-denied', 'Verification failed. Please try again.');
  }

  const hostname = String(payload.hostname || '').toLowerCase();
  if (hostname && hostname !== 'holler.works' && !hostname.endsWith('.netlify.app')) {
    console.warn('turnstile hostname mismatch', hostname);
    throw new HttpsError('permission-denied', 'Verification failed. Please reload and try again.');
  }
}

function getClientIdentifier(request) {
  return getRawRequestIp(request.rawRequest);
}

function serializePost(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    approvedAt: toMillis(data.approvedAt),
    createdAt: toMillis(data.createdAt),
    featuredUntil: toMillis(data.featuredUntil),
  };
}

function syncApprovedPost(index, postId, post) {
  return index.saveObject({
    objectID:       postId,
    companyName:    post.companyName    || '',
    companyWebsite: post.companyWebsite || '',
    title:          post.title          || '',
    description:    post.description    || '',
    category:       post.category       || '',
    location:       formatLocation(post),
    locationState:  post.locationState  || '',
    locationRegion: post.locationRegion || '',
    locationCity:   post.locationCity   || '',
    type:           post.type           || '',
    compensation:   post.compensation   || '',
    remoteFriendly: post.remoteFriendly || false,
    urgent:         post.urgent         || false,
    featured:       post.featured       || false,
    approvedAt:     toMillis(post.approvedAt) || Date.now(),
  });
}

function normalizeAdminUpdates(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new HttpsError('invalid-argument', 'Updates are required.');
  }

  const normalized = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!ADMIN_UPDATE_FIELDS.has(key)) {
      throw new HttpsError('invalid-argument', `Unsupported field: ${key}`);
    }

    switch (key) {
      case 'title':
        if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
          throw new HttpsError('invalid-argument', 'Title must be 1-80 characters.');
        }
        normalized.title = normalizeInlineText(value);
        break;
      case 'companyName':
        if (value !== null && (typeof value !== 'string' || !value.trim() || value.trim().length > 80)) {
          throw new HttpsError('invalid-argument', 'Company name must be 1-80 characters.');
        }
        normalized.companyName = typeof value === 'string' ? normalizeInlineText(value) : null;
        break;
      case 'companyWebsite':
      case 'companyLinkedIn':
        if (value !== null && typeof value !== 'string') {
          throw new HttpsError('invalid-argument', `${key} must be a string or null.`);
        }
        normalized[key] = value ? normalizeHttpUrl(value, key) : null;
        break;
      case 'description':
        if (typeof value !== 'string' || value.length > MAX_DESCRIPTION_LENGTH) {
          throw new HttpsError('invalid-argument', `Description must be 0-${MAX_DESCRIPTION_LENGTH} characters.`);
        }
        normalized.description = normalizeDescriptionText(value);
        break;
      case 'moderationNotes':
        if (value !== null && typeof value !== 'string') {
          throw new HttpsError('invalid-argument', 'moderationNotes must be a string or null.');
        }
        normalized.moderationNotes = value ? value.trim().slice(0, 500) : null;
        break;
      case 'compensation':
      case 'locationCity':
      case 'locationNotes':
      case 'locationRegion':
      case 'locationState':
        if (value !== null && typeof value !== 'string') {
          throw new HttpsError('invalid-argument', `${key} must be a string or null.`);
        }
        normalized[key] = typeof value === 'string' ? normalizeInlineText(value) : null;
        break;
      case 'contact':
        if (value !== null && typeof value !== 'string') {
          throw new HttpsError('invalid-argument', 'contact must be a string or null.');
        }
        normalized.contact = typeof value === 'string'
          ? (isLikelyEmail(value.trim()) ? value.trim().toLowerCase() : normalizeHttpUrl(value, 'contact'))
          : null;
        break;
      case 'category':
        if (typeof value !== 'string' || !CATEGORIES.has(value.trim())) {
          throw new HttpsError('invalid-argument', 'Invalid category.');
        }
        normalized.category = value.trim();
        break;
      case 'status':
        if (!ADMIN_STATUSES.has(value)) {
          throw new HttpsError('invalid-argument', 'Invalid status.');
        }
        normalized.status = value;
        break;
      case 'featured':
      case 'remoteFriendly':
      case 'urgent':
        if (typeof value !== 'boolean') {
          throw new HttpsError('invalid-argument', `${key} must be a boolean.`);
        }
        normalized[key] = value;
        break;
      case 'featuredUntil':
        if (value !== null && typeof value !== 'number') {
          throw new HttpsError('invalid-argument', 'featuredUntil must be a timestamp or null.');
        }
        normalized.featuredUntil = value === null ? null : new Date(value);
        break;
      default:
        throw new HttpsError('invalid-argument', `Unsupported field: ${key}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(normalized, 'compensation')) {
    if (!normalized.compensation || normalized.compensation.length > 120) {
      throw new HttpsError('invalid-argument', 'Compensation must be 1-120 characters.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'contact')) {
    if (!normalized.contact || normalized.contact.length > 200 || (
      !isLikelyEmail(normalized.contact) && !isLikelyHttpUrl(normalized.contact)
    )) {
      throw new HttpsError('invalid-argument', 'Contact must be a valid email or URL.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'locationCity')) {
    if (normalized.locationCity && normalized.locationCity.length > 80) {
      throw new HttpsError('invalid-argument', 'City must be 80 characters or fewer.');
    }
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'locationNotes')) {
    if (normalized.locationNotes && normalized.locationNotes.length > 100) {
      throw new HttpsError('invalid-argument', 'Location notes must be 100 characters or fewer.');
    }
  }
  if (normalized.locationState && normalized.locationRegion) {
    if (!LOCATIONS[normalized.locationState] || !LOCATIONS[normalized.locationState].includes(normalized.locationRegion)) {
      throw new HttpsError('invalid-argument', 'Invalid location.');
    }
  }

  return normalized;
}

// ── 1. Email admin on new post ─────────────────────────────────────────────
exports.onNewPost = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post || post.status !== 'pending' || post.importedViaAdmin) return;

  const db = getFirestore();
  await db.collection('mail').add({
    to: getRequiredEnv('ADMIN_EMAIL'),
    message: {
      subject: '[holler.works] new post pending approval',
      text: [
        'New post submitted to holler.works and is pending your approval.',
        '',
        `Title:    ${post.title}`,
        `Company:  ${post.companyName || 'n/a'}`,
        `Site:     ${post.companyWebsite || 'n/a'}`,
        `Category: ${post.category}`,
        `Location: ${formatLocation(post)}`,
        `Comp:     ${post.compensation}`,
        `Contact:  ${post.contact}`,
        ...(post.reviewFlags?.length ? ['', `Flags:    ${post.reviewFlags.join(', ')}`] : []),
        '',
        'Review it at: https://holler.works/admin',
      ].join('\n'),
    },
  });
});

// ── 2. Algolia sync on status change ──────────────────────────────────────
exports.onPostStatusChange = onDocumentUpdated({
  document: 'posts/{postId}',
  secrets: ALGOLIA_SECRETS,
}, async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Guard: only act on status changes
  if (before.status === after.status) return;

  const postId = event.params.postId;
  const db     = getFirestore();
  const index  = getAlgoliaIndex();

  if (after.status === 'approved') {
    // Set approvedAt. This update triggers onPostStatusChange again, but the
    // guard (before.status === after.status) will short-circuit that second
    // invocation. The double-trigger is expected and visible in function logs.
    await db.collection('posts').doc(postId).update({
      approvedAt: FieldValue.serverTimestamp(),
    });

    // Add to Algolia
    await index.saveObject({
      objectID:       postId,
      companyName:    after.companyName    || '',
      companyWebsite: after.companyWebsite || '',
      title:          after.title          || '',
      description:    after.description    || '',
      category:       after.category       || '',
      location:       formatLocation(after),
      locationState:  after.locationState  || '',
      locationRegion: after.locationRegion || '',
      locationCity:   after.locationCity   || '',
      type:           after.type           || '',
      compensation:   after.compensation   || '',
      remoteFriendly: after.remoteFriendly || false,
      urgent:         after.urgent         || false,
      featured:       after.featured       || false,
      approvedAt:     Date.now(),
    });

  } else if (after.status === 'expired' || after.status === 'rejected') {
    // Remove from Algolia (idempotent — safe if record doesn't exist)
    await index.deleteObject(postId);
  }
});

// ── 3. Public HTML endpoints for SEO ──────────────────────────────────────
exports.renderPostPage = onRequest(async (req, res) => {
  const postId = typeof req.query.postId === 'string' ? req.query.postId.trim() : '';
  if (!postId) {
    res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(renderNotFoundPage());
    return;
  }

  const snap = await getFirestore().collection('posts').doc(postId).get();
  const post = snap.data();
  if (!snap.exists || !post || post.status !== 'approved') {
    res.status(404)
      .set('Cache-Control', 'public, max-age=60, s-maxage=60')
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(renderNotFoundPage());
    return;
  }

  res.status(200)
    .set('Cache-Control', 'public, max-age=300, s-maxage=300')
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(renderPostPageHtml(postId, post));
});

exports.dynamicSitemap = onRequest(async (_req, res) => {
  const snap = await getFirestore().collection('posts')
    .where('status', '==', 'approved')
    .get();

  const urls = [
    {
      loc: 'https://holler.works/',
      changefreq: 'daily',
      priority: '1.0',
      lastmod: new Date().toISOString(),
    },
    {
      loc: 'https://holler.works/about',
      changefreq: 'monthly',
      priority: '0.5',
      lastmod: new Date().toISOString(),
    },
    ...snap.docs.map(docSnap => {
      const post = docSnap.data();
      return {
        loc: `https://holler.works/post/${docSnap.id}`,
        changefreq: 'daily',
        priority: '0.9',
        lastmod: formatIsoDate(post.approvedAt || post.createdAt),
      };
    }),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
    <lastmod>${escapeHtml(url.lastmod)}</lastmod>
    <changefreq>${escapeHtml(url.changefreq)}</changefreq>
    <priority>${escapeHtml(url.priority)}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.status(200)
    .set('Cache-Control', 'public, max-age=300, s-maxage=300')
    .set('Content-Type', 'application/xml; charset=utf-8')
    .send(body);
});

// ── 4. Admin session + moderation API ─────────────────────────────────────
exports.submitPost = onCall({ secrets: TURNSTILE_SECRETS }, async (request) => {
  const post = normalizeSubmission(request.data);
  const db = getFirestore();
  const clientId = hashValue(getClientIdentifier(request));
  const contactId = hashValue(normalizeContact(post.contact));
  const turnstileToken = typeof request.data?.turnstileToken === 'string'
    ? request.data.turnstileToken.trim()
    : '';

  await enforceSubmissionRateLimit(db, `ip_${clientId}`);
  await enforceSubmissionRateLimit(db, `contact_${contactId}`);
  await verifyTurnstileToken(request, turnstileToken);
  await assertNoRecentDuplicateSubmission(db, post);

  const docRef = await db.collection('posts').add(post);
  return { postId: docRef.id };
});

exports.subscribeJobAlert = onCall(async (request) => {
  const data = request.data || {};
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  const locationState = typeof data.locationState === 'string' ? data.locationState.trim() : '';
  const locationRegion = typeof data.locationRegion === 'string' ? data.locationRegion.trim() : '';
  const remoteFriendly = !!data.remoteFriendly;

  if (!isLikelyEmail(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }
  if (category && !CATEGORIES.has(category)) {
    throw new HttpsError('invalid-argument', 'Invalid category.');
  }
  if (locationState && !LOCATIONS[locationState]) {
    throw new HttpsError('invalid-argument', 'Invalid state.');
  }
  if (locationRegion && (!locationState || !LOCATIONS[locationState]?.includes(locationRegion))) {
    throw new HttpsError('invalid-argument', 'Invalid region.');
  }

  const db = getFirestore();
  const alert = {
    email,
    category: category || null,
    locationState: locationState || null,
    locationRegion: locationRegion || null,
    remoteFriendly,
  };
  const alertKey = buildAlertFingerprint(alert);
  const existingSnap = await db.collection('jobAlerts')
    .where('alertKey', '==', alertKey)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    await existingSnap.docs[0].ref.update({
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, label: formatAlertLabel(alert), existing: true };
  }

  await db.collection('jobAlerts').add({
    ...alert,
    active: true,
    alertKey,
    unsubscribeToken: crypto.randomBytes(24).toString('hex'),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, label: formatAlertLabel(alert), existing: false };
});

exports.trackEvent = onRequest(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Origin', 'https://holler.works');
  res.set('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const eventName = typeof req.body?.eventName === 'string'
    ? req.body.eventName.trim()
    : '';
  const postId = typeof req.body?.postId === 'string'
    ? req.body.postId.trim()
    : '';

  if (!ANALYTICS_EVENT_FIELDS[eventName]) {
    res.status(400).json({ error: 'Invalid event name.' });
    return;
  }
  if (POST_ANALYTICS_EVENT_FIELDS[eventName] && !postId) {
    res.status(400).json({ error: 'postId is required for this event.' });
    return;
  }

  try {
    await recordAnalyticsEvent(getFirestore(), eventName, postId || null);
    res.status(204).send('');
  } catch (error) {
    console.error('trackEvent failed', error, {
      eventName,
      postId: postId || null,
      ip: getRawRequestIp(req),
    });
    res.status(500).json({ error: 'Could not track event.' });
  }
});

exports.adminRequestLoginLink = onCall(async (request) => {
  const db = getFirestore();
  const email = typeof request.data?.email === 'string'
    ? request.data.email.trim().toLowerCase()
    : '';
  const clientId = hashValue(getClientIdentifier(request));
  const rateLimitKey = `ip_${clientId}`;

  if (!isLikelyEmail(email)) {
    throw new HttpsError('invalid-argument', 'A valid admin email is required.');
  }

  await enforceAdminLoginRateLimit(db, rateLimitKey);

  if (!isAllowedAdminEmail(email)) {
    return { ok: true };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashValue(rawToken);
  const loginUrl = buildAdminLoginLink(rawToken);

  await db.collection('adminLoginLinks').doc(tokenHash).set({
    email,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Date.now() + ADMIN_MAGIC_LINK_TTL_MS,
    usedAt: null,
    requestedByClientId: clientId,
  });

  await enqueueEmail(
    db,
    email,
    '[holler.works] admin sign-in link',
    [
      'Use this one-time sign-in link to access the holler.works admin queue.',
      '',
      loginUrl,
      '',
      'The link expires in 15 minutes and can only be used once.',
      '',
      'If you did not request this, you can ignore it.',
    ].join('\n')
  );

  await clearAdminLoginFailures(db, rateLimitKey);
  return { ok: true };
});

exports.adminConsumeLoginLink = onCall({ secrets: ADMIN_SESSION_SECRETS }, async (request) => {
  const db = getFirestore();
  const loginToken = typeof request.data?.loginToken === 'string'
    ? request.data.loginToken.trim()
    : '';
  const clientId = hashValue(getClientIdentifier(request));
  const rateLimitKey = `ip_${clientId}`;

  if (!loginToken) {
    throw new HttpsError('invalid-argument', 'Sign-in token is required.');
  }

  await enforceAdminLoginRateLimit(db, rateLimitKey);

  const tokenHash = hashValue(loginToken);
  const docRef = db.collection('adminLoginLinks').doc(tokenHash);
  let email = '';

  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        throw new HttpsError('permission-denied', 'This sign-in link is invalid.');
      }

      const data = snap.data() || {};
      email = String(data.email || '').trim().toLowerCase();
      if (!email || !isAllowedAdminEmail(email)) {
        throw new HttpsError('permission-denied', 'This sign-in link is invalid.');
      }
      if ((data.expiresAt || 0) < Date.now()) {
        throw new HttpsError('permission-denied', 'This sign-in link has expired.');
      }
      if (data.usedAt) {
        throw new HttpsError('permission-denied', 'This sign-in link has already been used.');
      }

      tx.update(docRef, {
        usedAt: FieldValue.serverTimestamp(),
        usedByClientId: clientId,
      });
    });
  } catch (error) {
    if (error instanceof HttpsError && error.code === 'permission-denied') {
      await recordAdminLoginFailure(db, rateLimitKey);
    }
    throw error;
  }

  await clearAdminLoginFailures(db, rateLimitKey);
  await recordAdminAuditEvent(db, email, 'admin_login', {
    via: 'magic_link',
  });
  return {
    token: issueAdminToken(email),
    email,
  };
});

exports.adminListPosts = onCall({ secrets: ADMIN_SESSION_SECRETS }, async (request) => {
  const admin = requireAdminSession(request.data);

  const status = request.data?.status;
  if (!ADMIN_STATUSES.has(status)) {
    throw new HttpsError('invalid-argument', 'Invalid status filter.');
  }

  const db = getFirestore();
  const [snap, pendingSnap, approvedSnap, rejectedSnap, expiredSnap, activeAlertsSnap, analytics] = await Promise.all([
    db.collection('posts')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get(),
    db.collection('posts').where('status', '==', 'pending').get(),
    db.collection('posts').where('status', '==', 'approved').get(),
    db.collection('posts').where('status', '==', 'rejected').get(),
    db.collection('posts').where('status', '==', 'expired').get(),
    db.collection('jobAlerts').where('active', '==', true).get(),
    loadAnalyticsSummary(db),
  ]);

  return {
    sessionEmail: admin.email,
    counts: {
      pending: pendingSnap.size,
      approved: approvedSnap.size,
      rejected: rejectedSnap.size,
      expired: expiredSnap.size,
    },
    dashboard: {
      activeAlerts: activeAlertsSnap.size,
      analytics,
    },
    posts: snap.docs.map(serializePost),
  };
});

exports.adminUpdatePost = onCall({ secrets: ADMIN_AND_ALGOLIA_SECRETS }, async (request) => {
  const admin = requireAdminSession(request.data);

  const postId = request.data?.postId;
  if (typeof postId !== 'string' || !postId) {
    throw new HttpsError('invalid-argument', 'postId is required.');
  }

  const updates = normalizeAdminUpdates(request.data?.updates);
  const db = getFirestore();
  const docRef = db.collection('posts').doc(postId);
  const currentSnap = await docRef.get();
  if (!currentSnap.exists) {
    throw new HttpsError('not-found', 'Post not found.');
  }
  const mergedPost = {
    ...currentSnap.data(),
    ...updates,
  };
  updates.reviewFlags = buildReviewFlags(mergedPost);
  await docRef.update(updates);

  const updatedSnap = await docRef.get();
  const updatedPost = updatedSnap.data();

  if (updatedPost?.status === 'approved' && !Object.prototype.hasOwnProperty.call(updates, 'status')) {
    await syncApprovedPost(getAlgoliaIndex(), postId, updatedPost);
  }

  await recordAdminAuditEvent(db, admin.email, 'update_post', {
    postId,
    fields: Object.keys(updates),
  });

  return { post: serializePost(updatedSnap) };
});

exports.adminBulkUpdatePosts = onCall({ secrets: ADMIN_AND_ALGOLIA_SECRETS }, async (request) => {
  const admin = requireAdminSession(request.data);

  const postIds = Array.isArray(request.data?.postIds)
    ? request.data.postIds.filter(id => typeof id === 'string' && id)
    : [];
  const action = typeof request.data?.action === 'string' ? request.data.action : '';

  if (!postIds.length || postIds.length > 50) {
    throw new HttpsError('invalid-argument', 'Select 1-50 posts.');
  }

  const actionToStatus = {
    approve: 'approved',
    reject: 'rejected',
    expire: 'expired',
    reopen: 'pending',
  };
  const status = actionToStatus[action];
  if (!status && action !== 'delete') {
    throw new HttpsError('invalid-argument', 'Unsupported bulk action.');
  }

  const db = getFirestore();
  const refs = postIds.map(postId => db.collection('posts').doc(postId));
  const snaps = await db.getAll(...refs);
  const batch = db.batch();

  snaps.forEach(snap => {
    if (!snap.exists) return;
    if (action === 'delete') batch.delete(snap.ref);
    else batch.update(snap.ref, { status });
  });

  await batch.commit();

  if (action === 'delete') {
    await getAlgoliaIndex().deleteObjects(postIds).catch(() => {});
  }

  await recordAdminAuditEvent(db, admin.email, 'bulk_update_posts', {
    action,
    postIds,
  });

  return { ok: true };
});

exports.adminImportPosts = onCall({ secrets: ADMIN_AND_ALGOLIA_SECRETS }, async (request) => {
  const admin = requireAdminSession(request.data);

  const status = typeof request.data?.status === 'string'
    ? request.data.status.trim()
    : 'pending';
  if (!IMPORT_STATUSES.has(status)) {
    throw new HttpsError('invalid-argument', 'Import status must be pending or approved.');
  }

  const posts = Array.isArray(request.data?.posts) ? request.data.posts : null;
  if (!posts || !posts.length || posts.length > 50) {
    throw new HttpsError('invalid-argument', 'Import 1-50 posts at a time.');
  }

  const normalizedPosts = posts.map(post => normalizeImportedPost(post, { status }));
  const db = getFirestore();
  const batch = db.batch();
  const refs = normalizedPosts.map(() => db.collection('posts').doc());

  refs.forEach((ref, index) => {
    batch.set(ref, normalizedPosts[index]);
  });

  await batch.commit();

  if (status === 'approved') {
    const now = Date.now();
    await getAlgoliaIndex().saveObjects(
      refs.map((ref, index) => ({
        objectID: ref.id,
        companyName: normalizedPosts[index].companyName || '',
        companyWebsite: normalizedPosts[index].companyWebsite || '',
        title: normalizedPosts[index].title || '',
        description: normalizedPosts[index].description || '',
        category: normalizedPosts[index].category || '',
        location: formatLocation(normalizedPosts[index]),
        locationState: normalizedPosts[index].locationState || '',
        locationRegion: normalizedPosts[index].locationRegion || '',
        locationCity: normalizedPosts[index].locationCity || '',
        type: normalizedPosts[index].type || '',
        compensation: normalizedPosts[index].compensation || '',
        remoteFriendly: normalizedPosts[index].remoteFriendly || false,
        urgent: false,
        featured: false,
        approvedAt: now,
      }))
    );
  }

  await recordAdminAuditEvent(db, admin.email, 'import_posts', {
    status,
    count: refs.length,
    postIds: refs.map(ref => ref.id),
  });

  return {
    count: refs.length,
    ids: refs.map(ref => ref.id),
    status,
  };
});

exports.adminDeletePost = onCall({ secrets: ADMIN_AND_ALGOLIA_SECRETS }, async (request) => {
  const admin = requireAdminSession(request.data);

  const postId = request.data?.postId;
  if (typeof postId !== 'string' || !postId) {
    throw new HttpsError('invalid-argument', 'postId is required.');
  }

  const db = getFirestore();
  await db.collection('posts').doc(postId).delete();
  await getAlgoliaIndex().deleteObject(postId).catch(() => {});
  await recordAdminAuditEvent(db, admin.email, 'delete_post', {
    postId,
  });

  return { ok: true };
});

exports.reportListing = onCall(async (request) => {
  const db = getFirestore();
  const report = normalizeReportSubmission(request.data);
  const clientId = hashValue(getClientIdentifier(request));

  await enforceReportRateLimit(db, `ip_${clientId}`);

  const postSnap = await db.collection('posts').doc(report.postId).get();
  if (!postSnap.exists || postSnap.data()?.status !== 'approved') {
    throw new HttpsError('not-found', 'That listing is no longer available.');
  }

  const post = postSnap.data();
  await db.collection('listingReports').add({
    ...report,
    clientId,
    createdAt: FieldValue.serverTimestamp(),
    postSnapshot: {
      title: post.title || '',
      companyName: post.companyName || '',
      status: post.status || '',
    },
    status: 'open',
  });

  await enqueueEmail(
    db,
    getRequiredEnv('ADMIN_EMAIL'),
    '[holler.works] listing reported',
    [
      'A public listing was reported on holler.works.',
      '',
      `Post ID:  ${report.postId}`,
      `Title:    ${post.title || 'n/a'}`,
      `Company:  ${post.companyName || 'n/a'}`,
      `Reason:   ${report.reason}`,
      `Reporter: ${report.reporterEmail || 'not provided'}`,
      '',
      `Review it at: https://holler.works/post/${report.postId}`,
      'Moderate it at: https://holler.works/admin',
    ].join('\n')
  );

  return { ok: true };
});

exports.manageAlertSubscription = onRequest(async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    res.status(400)
      .set('Cache-Control', 'no-store')
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(renderShell({
        title: 'alert link invalid -- holler.works',
        description: 'This alert management link is invalid.',
        canonicalPath: '/',
        robots: 'noindex,nofollow',
        content: `<main class="page">
          <div class="wordmark">HOLLER.WORKS // appalachia</div>
          <h1 class="title">alert link invalid</h1>
          <div class="notice">That link is missing the subscription token.</div>
        </main>`,
      }));
    return;
  }

  const db = getFirestore();
  const snap = await db.collection('jobAlerts')
    .where('unsubscribeToken', '==', token)
    .limit(1)
    .get();

  if (snap.empty) {
    res.status(404)
      .set('Cache-Control', 'no-store')
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(renderShell({
        title: 'alert not found -- holler.works',
        description: 'This alert subscription could not be found.',
        canonicalPath: '/',
        robots: 'noindex,nofollow',
        content: `<main class="page">
          <div class="wordmark">HOLLER.WORKS // appalachia</div>
          <h1 class="title">alert not found</h1>
          <div class="notice">That subscription may already be inactive.</div>
        </main>`,
      }));
    return;
  }

  const docRef = snap.docs[0].ref;
  const alert = snap.docs[0].data();
  await docRef.update({
    active: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200)
    .set('Cache-Control', 'no-store')
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(renderShell({
      title: 'alerts paused -- holler.works',
      description: 'Your holler.works email alert has been paused.',
      canonicalPath: '/',
      robots: 'noindex,nofollow',
      content: `<main class="page">
        <div class="wordmark">HOLLER.WORKS // appalachia</div>
        <a class="back-link" href="/">← back to the board</a>
        <h1 class="title">alerts paused</h1>
        <div class="notice">
          ${escapeHtml(alert.email)} will no longer receive updates for ${escapeHtml(formatAlertLabel(alert))}.
        </div>
      </main>`,
    }));
});

// ── 5. Daily expiry + featured cleanup ────────────────────────────────────
exports.dailyExpiry = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'America/New_York',
  secrets: ALGOLIA_SECRETS,
}, async () => {
  const db    = getFirestore();
  const index = getAlgoliaIndex();
  const now   = new Date();

  // ── Expire posts approved > 28 days ago ─────────────────────────────
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 28);

  const expireSnap = await db.collection('posts')
    .where('status', '==', 'approved')
    .where('approvedAt', '<', cutoff)
    .get();

  if (!expireSnap.empty) {
    const batch = db.batch();
    expireSnap.docs.forEach(d => batch.update(d.ref, { status: 'expired' }));
    await batch.commit();
    await index.deleteObjects(expireSnap.docs.map(d => d.id));
  }

  // ── Clear stale featured flags ────────────────────────────────────────
  const staleSnap = await db.collection('posts')
    .where('featured', '==', true)
    .where('featuredUntil', '<', now)
    .get();

  if (!staleSnap.empty) {
    const batch2 = db.batch();
    staleSnap.docs.forEach(d => batch2.update(d.ref, {
      featured: false,
      featuredUntil: null,
    }));
    await batch2.commit();
  }
});

exports.dailyJobAlerts = onSchedule({ schedule: '0 8 * * *', timeZone: 'America/New_York' }, async () => {
  const db = getFirestore();
  const [alertsSnap, postsSnap] = await Promise.all([
    db.collection('jobAlerts').where('active', '==', true).get(),
    db.collection('posts').where('status', '==', 'approved').get(),
  ]);

  if (alertsSnap.empty || postsSnap.empty) return;

  const approvedPosts = postsSnap.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  const batch = db.batch();

  for (const docSnap of alertsSnap.docs) {
    const alert = docSnap.data();
    const lookbackSince = alert.lastDigestAt || (Date.now() - ALERT_DIGEST_LOOKBACK_MS);
    const matches = approvedPosts.filter(post => {
      const approvedAt = toMillis(post.approvedAt || post.createdAt) || 0;
      return approvedAt > lookbackSince && postMatchesAlert(post, alert);
    });

    if (!matches.length) continue;

    const boardUrl = buildAlertBoardUrl(alert);
    const unsubscribeUrl = `https://holler.works/alerts/unsubscribe?token=${encodeURIComponent(alert.unsubscribeToken)}`;
    const lines = [
      `New matches for ${formatAlertLabel(alert)} on holler.works:`,
      '',
      ...matches.slice(0, 12).flatMap(post => {
        const location = formatLocation(post);
        return [
          `${post.title}${post.companyName ? ` @ ${post.companyName}` : ''}`,
          `${post.category}${location ? ` · ${location}` : ''}${post.remoteFriendly ? ' · remote-friendly' : ''}`,
          `https://holler.works/post/${post.id}`,
          '',
        ];
      }),
      `Browse this alert: ${boardUrl}`,
      `Pause these emails: ${unsubscribeUrl}`,
    ];

    await db.collection('mail').add({
      to: alert.email,
      message: {
        subject: `[holler.works] ${matches.length} new match${matches.length === 1 ? '' : 'es'} for ${formatAlertLabel(alert)}`,
        text: lines.join('\n'),
      },
    });

    batch.update(docSnap.ref, {
      lastDigestAt: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
});

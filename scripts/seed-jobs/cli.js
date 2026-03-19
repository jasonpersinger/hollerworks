#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const MAX_DESCRIPTION_LENGTH = 3000;
const DEFAULT_MIN_SCORE = 35;
const DEFAULT_LIMIT = 100;
const CATEGORIES = [
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
];
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
const CATEGORY_KEYWORDS = [
  ['Software & Dev', ['software', 'engineer', 'developer', 'full stack', 'frontend', 'back end', 'backend', 'mobile', 'ios', 'android', 'web', 'application', 'programmer']],
  ['IT & Support', ['it support', 'help desk', 'desktop support', 'systems administrator', 'system administrator', 'network administrator', 'technical support', 'service desk', 'support engineer', 'application analyst', 'business systems analyst', 'audiovisual', 'av technician', 'technology support']],
  ['Data & AI', ['data', 'analytics', 'analyst', 'machine learning', 'ai ', 'ml ', 'scientist', 'business intelligence', 'bi engineer']],
  ['Design & UX', ['ux', 'ui', 'designer', 'design system', 'product design', 'visual design', 'interaction design']],
  ['Product & Project', ['product manager', 'project manager', 'program manager', 'scrum', 'scrum master', 'agile', 'technical project', 'technical program manager', 'product operations']],
  ['DevOps & Cloud', ['devops', 'site reliability', 'sre', 'cloud', 'platform engineer', 'infrastructure', 'kubernetes', 'terraform', 'aws', 'azure', 'gcp']],
  ['Cybersecurity', ['security', 'cyber', 'soc analyst', 'incident response', 'iam', 'grc', 'application security']],
  ['QA & Testing', ['qa', 'quality assurance', 'test engineer', 'automation engineer', 'sdet', 'manual tester']],
  ['Sales & Customer Success', ['solutions engineer', 'sales engineer', 'customer success', 'customer success engineer', 'implementation specialist', 'implementation manager', 'implementation consultant', 'implementation analyst', 'technical account', 'technical account manager', 'solutions consultant', 'customer onboarding']],
  ['Marketing & Content', ['content strategist', 'content marketer', 'content design', 'seo', 'seo specialist', 'seo manager', 'growth marketer', 'growth marketing', 'lifecycle marketing', 'digital marketing', 'marketing operations', 'product marketing']],
  ['Technical Writing & Docs', ['technical writer', 'documentation', 'docs', 'documentation engineer', 'developer relations', 'api writer', 'developer docs', 'knowledge base', 'release notes', 'api docs', 'help center', 'support content', 'technical communications']],
];
const CATEGORY_PRIORITY = {
  'Technical Writing & Docs': 3,
  'Data & AI': 2,
  'Cybersecurity': 2,
  'DevOps & Cloud': 2,
};
const TECH_SIGNALS = [
  'software', 'developer', 'engineer', 'product', 'design', 'data', 'security', 'cloud',
  'technical', 'qa', 'devops', 'it ', 'support', 'writer', 'documentation', 'seo',
  'customer success', 'implementation', 'technical account', 'knowledge base', 'help center',
  'marketing operations', 'lifecycle', 'scrum',
];
const NON_TECH_SIGNALS = [
  'registered nurse', 'licensed practical nurse', 'certified nursing assistant', 'truck driver', 'class a', 'forklift',
  'barista', 'cashier', 'waiter', 'cook', 'janitor', 'warehouse', 'machine operator',
  'teacher', 'principal', 'custodian', 'electrician', 'plumber', 'medical assistant',
  'internal communications', 'public affairs', 'people business partner', 'university recruiter',
  'talent attraction', 'recruiter', 'filmmaker', 'executive assistant', 'assistant controller',
  'hr generalist', 'human resources', 'communications manager',
];
const REMOTE_SIGNALS = [
  'remote', 'work from home', 'distributed', 'anywhere', 'telecommute',
];
const NON_REMOTE_SIGNALS = [
  'no remote',
  'not remote',
  'no remote options',
  'onsite only',
  'on-site only',
  'on site only',
  'in-person only',
];

function parseArgs(argv) {
  const options = {
    config: '',
    out: 'tmp/seed-import.json',
    report: 'tmp/seed-report.json',
    minScore: DEFAULT_MIN_SCORE,
    limit: DEFAULT_LIMIT,
    perSourceLimit: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--config') options.config = argv[i + 1] || '';
    if (arg === '--out') options.out = argv[i + 1] || options.out;
    if (arg === '--report') options.report = argv[i + 1] || options.report;
    if (arg === '--min-score') options.minScore = Number(argv[i + 1] || DEFAULT_MIN_SCORE);
    if (arg === '--limit') options.limit = Number(argv[i + 1] || DEFAULT_LIMIT);
    if (arg === '--per-source-limit') options.perSourceLimit = Number(argv[i + 1] || 0);
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  if (!options.config) {
    printHelp();
    throw new Error('--config is required');
  }
  return options;
}

function printHelp() {
  console.log(
    [
      'Usage:',
      '  npm run seed:jobs -- --config scripts/seed-jobs/sources.example.json',
      '',
      'Options:',
      '  --config      path to the source config JSON (required)',
      '  --out         where to write the review-ready import JSON',
      '  --report      where to write the processing report JSON',
      '  --min-score   minimum relevance score to keep (default 35)',
      '  --limit       maximum posts to write (default 100)',
      '  --per-source-limit  maximum posts to keep per source in final output (default unlimited)',
    ].join('\n')
  );
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeStructuredText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function removeHttpUrls(value) {
  return String(value || '').replace(/https?:\/\/\S+/gi, ' ');
}

function stripHtml(value) {
  return normalizeStructuredText(
    removeHttpUrls(
      decodeHtmlEntities(value)
    )
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n\n')
      .replace(/<(h[1-6]|div|section|article)[^>]*>/gi, '\n')
      .replace(/<\/(h[1-6]|div|section|article)>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<li>/gi, '\n- ')
      .replace(/<\/li>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
  );
}

function cleanupDescriptionLine(value) {
  return normalizeWhitespace(
    String(value || '')
      .replace(/^[-*]\s*/, '')
      .replace(/\s*[|:]\s*$/, '')
  );
}

function isHeadingLine(value) {
  const line = cleanupDescriptionLine(value);
  if (!line) return false;
  if (line.length > 80) return false;
  if (/^[A-Z0-9\s&/,+()-]+$/.test(line)) return true;
  return [
    'what you’ll do',
    "what you'll do",
    'what we’re looking for',
    "what we're looking for",
    'required qualifications',
    'minimum qualifications',
    'preferred qualifications',
    'about the role',
    'about you',
    'role at a glance',
    'role overview',
    'responsibilities',
    'technologies we use',
    'in this role, you will',
  ].includes(line.toLowerCase());
}

function isBoilerplateLine(value) {
  const line = cleanupDescriptionLine(value).toLowerCase();
  if (!line) return true;
  return [
    'who we are',
    'what we do',
    'about us',
    'our mission',
    'who you are',
    'why join',
    'benefits',
    'who we are looking for',
    'equal opportunity employer',
    'equal opportunity',
    'eeo',
    'privacy notice',
    'accommodation',
    'life at',
    'our values',
    'join our life-changing mission',
    'read to learn more',
    'other duties as assigned',
  ].some(token => line === token || line.startsWith(`${token} `) || line.includes(token));
}

function extractRelevantDescription(rawDescription, title = '') {
  const text = stripHtml(rawDescription);
  const lines = text
    .split(/\n+/)
    .map(cleanupDescriptionLine)
    .filter(Boolean);

  if (!lines.length) return '';

  const preferredHeadings = [
    'about the role',
    'role at a glance',
    'role overview',
    'what you’ll do',
    "what you'll do",
    'in this role, you will',
    'responsibilities',
    'required qualifications',
    'minimum qualifications',
    'what we’re looking for',
    "what we're looking for",
    'about you',
    'technologies we use',
  ];
  const stopHeadings = [
    'who we are',
    'what we do',
    'about us',
    'benefits',
    'equal opportunity employer',
    'equal opportunity',
    'privacy notice',
    'our mission',
  ];

  const lowerLines = lines.map(line => line.toLowerCase());
  let startIndex = lowerLines.findIndex(line => preferredHeadings.includes(line));

  if (startIndex === -1) {
    const titleWord = String(title || '').toLowerCase();
    startIndex = lowerLines.findIndex(line => (
      line.includes('in this role')
      || line.includes('we are looking for')
      || line.includes('we’re looking for')
      || line.includes("we're looking for")
      || (titleWord && line.includes(titleWord))
    ));
  }

  const selected = [];
  const seen = new Set();
  const begin = startIndex > 0 ? Math.max(0, startIndex - 1) : 0;

  for (let index = begin; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();

    if (index > begin && stopHeadings.includes(lower)) break;
    if (isBoilerplateLine(line)) continue;
    if (line.length < 3) continue;

    const normalized = lower.replace(/[^\w]+/g, ' ').trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    selected.push(line);
    if (selected.length >= 18) break;
    if (selected.join('\n').length >= 1400) break;
  }

  const fallback = lines.filter(line => !isBoilerplateLine(line)).slice(0, 10);
  const chosen = selected.length ? selected : fallback;

  return truncate(
    chosen
      .filter(line => {
        const lower = line.toLowerCase();
        return ![
          'aurora hires talented people',
          'at duolingo',
          'duolingo is the world',
          'toast creates technology',
          'gecko robotics is helping',
          'join our life-changing mission',
          'read to learn more',
        ].some(token => lower.includes(token));
      })
      .map(line => (isHeadingLine(line) ? `${line}:` : line))
      .join('\n')
  );
}

function truncate(value, max = MAX_DESCRIPTION_LENGTH) {
  const text = normalizeWhitespace(value);
  if (text.length <= max) return text;
  const shortened = text.slice(0, max - 3);
  const cut = shortened.lastIndexOf(' ');
  return `${(cut > 200 ? shortened.slice(0, cut) : shortened).trim()}...`;
}

function normalizeUrl(value) {
  const input = normalizeWhitespace(value);
  if (!input) return '';
  try {
    const url = input.startsWith('http://') || input.startsWith('https://')
      ? new URL(input)
      : new URL(`https://${input}`);
    return url.toString();
  } catch {
    return '';
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function weightedKeywordScore(text, keyword) {
  return text.includes(keyword) ? 1 : 0;
}

function guessCategory(title, department, description) {
  const titleText = String(title || '').toLowerCase();
  const departmentText = String(department || '').toLowerCase();
  const descriptionText = String(description || '').toLowerCase();

  const titleOverrides = [
    ['Product & Project', /(director of product management|head of product|product management)/],
    ['Sales & Customer Success', /(solutions engineer|sales engineer|customer success|customer success engineer|implementation specialist|implementation manager|implementation consultant|implementation analyst|technical account|technical account manager|solutions consultant|customer onboarding)/],
    ['Product & Project', /(product manager|program manager|project manager|technical program manager)/],
    ['Technical Writing & Docs', /(technical writer|documentation|documentation engineer|doc(s)?\b|content writer|api writer|developer relations|knowledge base|help center|technical communications)/],
    ['Other Tech-Adjacent', /(systems engineer|mechanical engineer|electrical engineer|structures engineer|propulsion engineer|reliability|maintainability|safety engineer)/],
    ['IT & Support', /(business systems analyst|systems analyst|application analyst|support engineer)/],
    ['IT & Support', /(client services analyst|service desk analyst|support analyst|desktop support analyst)/],
    ['IT & Support', /(audiovisual|av technician|technology support analyst|desktop technician|end user support)/],
    ['IT & Support', /(it support|support specialist|technical support|service desk|help desk|systems administrator|desktop support)/],
    ['QA & Testing', /(qa\b|quality engineer|test engineer|automation engineer|sdet)/],
    ['Cybersecurity', /(security|cyber|iam|grc|soc analyst)/],
    ['DevOps & Cloud', /(devops|site reliability|sre|platform engineer|cloud|infrastructure|kubernetes|terraform)/],
    ['Software & Dev', /(software engineer|software developer|developer|fullstack|full stack|frontend|backend|ios|android|web engineer|robotics software engineer)/],
    ['Data & AI', /(machine learning|artificial intelligence|\bai\b|data scientist|data engineer|data analyst|analytics|bi engineer)/],
    ['Design & UX', /(designer|design\b|ux\b|ui\b|learning design|product design|visual design)/],
    ['Marketing & Content', /(marketing|marketing operations|product marketing|seo|growth|lifecycle|content strategist|content marketing|demand generation)/],
  ];

  for (const [category, pattern] of titleOverrides) {
    if (pattern.test(titleText)) return category;
  }

  let bestCategory = 'Other Tech-Adjacent';
  let bestScore = 0;

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    const titleDeptScore = keywords.reduce((total, keyword) => (
      total
      + (weightedKeywordScore(titleText, keyword) * 3)
      + (weightedKeywordScore(departmentText, keyword) * 2)
    ), 0);
    const descriptionScore = keywords.reduce((total, keyword) => total + weightedKeywordScore(descriptionText, keyword), 0);
    const score = titleDeptScore > 0 ? titleDeptScore : descriptionScore;
    const currentPriority = CATEGORY_PRIORITY[category] || 0;
    const bestPriority = CATEGORY_PRIORITY[bestCategory] || 0;
    if (score > bestScore || (score === bestScore && score > 0 && currentPriority > bestPriority)) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

function extractCompensation(...values) {
  const candidates = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;

    const variants = [
      normalized,
      normalizeWhitespace(decodeHtmlEntities(normalized)),
      normalizeWhitespace(stripHtml(normalized)),
    ];

    for (const text of variants) {
      if (!text) continue;
      const matches = text.match(
        /\$[\d,.]+(?:\s?[kK])?(?:\s*(?:-|to|–|—)\s*\$?[\d,.]+(?:\s?[kK])?)?(?:\s*(?:usd|\/|per)\s*(?:year|yr|annum|hour|hr|month|mo|week|wk|day|daily)?)?/gi
      );
      if (!matches) continue;
      candidates.push(...matches.map(match => match.replace(/\s+/g, ' ').trim()));
    }
  }
  if (!candidates.length) return '';

  const ranked = candidates
    .map(candidate => {
      const numeric = candidate
        .replace(/\$/g, ' ')
        .replace(/,/g, '')
        .match(/[\d.]+(?:\s?[kK])?/g) || [];
      const nums = numeric.map(part => {
        const clean = part.toLowerCase().replace(/\s+/g, '');
        if (clean.endsWith('k')) return Number(clean.slice(0, -1)) * 1000;
        return Number(clean);
      }).filter(Boolean);
      const maxValue = nums.length ? Math.max(...nums) : 0;
      let score = 0;
      if (candidate.match(/(?:-|to|–|—)/)) score += 30;
      if (candidate.match(/\/|per/)) score += 15;
      if (candidate.match(/year|yr|hour|hr/i)) score += 15;
      if (maxValue >= 50000) score += 20;
      else if (maxValue >= 1000) score += 5;
      else score -= 30;
      if (nums.length >= 2 && nums[0] > nums[nums.length - 1]) score -= 60;
      if (maxValue >= 1000000000) score -= 100;
      if (candidate.match(/\$[1-9]\d{0,2}(?![\d,])/)) score -= 20;
      return { candidate, score, maxValue };
    })
    .sort((left, right) => right.score - left.score || right.maxValue - left.maxValue);

  return ranked[0]?.score > 0 ? ranked[0].candidate : '';
}

function looksRemote(...values) {
  const haystack = values.map(value => String(value || '').toLowerCase()).join(' ');
  if (NON_REMOTE_SIGNALS.some(signal => haystack.includes(signal))) return false;
  return REMOTE_SIGNALS.some(signal => haystack.includes(signal));
}

function inferCity(rawLocation) {
  const parts = String(rawLocation || '')
    .split(/,|\||\//)
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  const [first] = parts;
  if (/remote/i.test(first) || first.length > 80) return '';
  return first;
}

function applyLocationRules(rawLocation, rules) {
  const text = String(rawLocation || '').trim();
  if (!text || !Array.isArray(rules) || !rules.length) return null;

  for (const rule of rules) {
    const pattern = String(rule.match || '').trim();
    if (!pattern) continue;
    let matches = false;
    try {
      matches = new RegExp(pattern, 'i').test(text);
    } catch {
      matches = text.toLowerCase().includes(pattern.toLowerCase());
    }
    if (!matches) continue;
    return {
      locationState: rule.locationState || '',
      locationRegion: rule.locationRegion || '',
      locationCity: rule.locationCity || inferCity(text),
      locationNotes: rule.locationNotes || '',
      remoteFriendly: typeof rule.remoteFriendly === 'boolean' ? rule.remoteFriendly : undefined,
    };
  }

  return null;
}

function buildFingerprint(post) {
  return [
    String(post.title || '').trim().toLowerCase(),
    String(post.companyName || '').trim().toLowerCase(),
    String(post.contact || '').trim().toLowerCase(),
  ].join('|');
}

function buildTitleLocationFingerprint(post) {
  return [
    String(post.title || '').trim().toLowerCase(),
    String(post.companyName || '').trim().toLowerCase(),
    String(post.locationState || '').trim().toLowerCase(),
    String(post.locationRegion || '').trim().toLowerCase(),
    String(post.locationCity || '').trim().toLowerCase(),
  ].join('|');
}

function textIncludesKeyword(text, keyword) {
  return String(text || '').toLowerCase().includes(String(keyword || '').toLowerCase());
}

function validateSourceRules(post, source) {
  const title = String(post.title || '').toLowerCase();
  const department = String(post._seedMeta?.department || '').toLowerCase();
  const titleDepartment = `${title} ${department}`.trim();
  const titleOrDepartmentIncludeKeywords = Array.isArray(source.titleOrDepartmentIncludeKeywords)
    ? source.titleOrDepartmentIncludeKeywords
    : [];
  if (
    titleOrDepartmentIncludeKeywords.length
    && !titleOrDepartmentIncludeKeywords.some(keyword => textIncludesKeyword(titleDepartment, keyword))
  ) {
    return 'Title/department did not match required source keywords.';
  }

  const titleOrDepartmentExcludeKeywords = Array.isArray(source.titleOrDepartmentExcludeKeywords)
    ? source.titleOrDepartmentExcludeKeywords
    : [];
  if (titleOrDepartmentExcludeKeywords.some(keyword => textIncludesKeyword(titleDepartment, keyword))) {
    return 'Title/department matched excluded source keywords.';
  }

  return '';
}

function scorePost(post, source) {
  let score = 0;
  const notes = [];
  const title = String(post.title || '').toLowerCase();
  const description = String(post.description || '').toLowerCase();
  const locationText = `${post.locationCity || ''} ${post.locationRegion || ''} ${post.locationState || ''}`.toLowerCase();
  const strongTechnicalTitle = /(engineer|developer|architect|security|cyber|data|analytics|business intelligence|site reliability|sre|cloud|devops|systems administrator|system administrator|product manager|program manager)/.test(title);

  if (source.sourceWeight) {
    score += Number(source.sourceWeight) || 0;
    notes.push(`source weight +${Number(source.sourceWeight) || 0}`);
  }
  if (source.locationState && source.locationRegion) {
    score += 25;
    notes.push('Appalachia tie +25');
  }
  if (post.remoteFriendly) {
    score += 15;
    notes.push('remote-friendly +15');
  }
  if (post.category && post.category !== 'Other Tech-Adjacent') {
    score += 20;
    notes.push(`category match +20 (${post.category})`);
  }
  if (TECH_SIGNALS.some(keyword => title.includes(keyword) || description.includes(keyword))) {
    score += 15;
    notes.push('tech signal +15');
  }
  if (!strongTechnicalTitle && NON_TECH_SIGNALS.some(keyword => title.includes(keyword) || description.includes(keyword))) {
    score -= 80;
    notes.push('non-tech signal -80');
  }
  const includeKeywords = Array.isArray(source.includeKeywords) ? source.includeKeywords : [];
  if (includeKeywords.length && includeKeywords.some(keyword => `${title} ${description}`.includes(String(keyword).toLowerCase()))) {
    score += 15;
    notes.push('include keyword +15');
  }
  const excludeKeywords = Array.isArray(source.excludeKeywords) ? source.excludeKeywords : [];
  if (excludeKeywords.length && excludeKeywords.some(keyword => `${title} ${description}`.includes(String(keyword).toLowerCase()))) {
    score -= 100;
    notes.push('exclude keyword -100');
  }
  if (locationText.includes('remote')) {
    score += 5;
    notes.push('remote location text +5');
  }

  return { score, notes };
}

function validateLocation(post) {
  return Boolean(
    LOCATIONS[post.locationState]
    && LOCATIONS[post.locationState].includes(post.locationRegion)
  );
}

function validatePost(post) {
  if (!post.title || post.title.length < 6 || post.title.length > 80) return 'Title must be 6-80 characters.';
  if (!CATEGORIES.includes(post.category)) return 'Category is invalid.';
  if (!post.companyName || post.companyName.length < 2 || post.companyName.length > 80) return 'Company name must be 2-80 characters.';
  if (!normalizeUrl(post.companyWebsite)) return 'Company website is required.';
  if (!validateLocation(post)) return 'Location state/region must match the Holler location map.';
  if (!post.compensation || post.compensation.length < 2 || post.compensation.length > 120) return 'Compensation is required.';
  if ((post.description || '').length > MAX_DESCRIPTION_LENGTH) return `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters.`;
  if (!post.contact || (!normalizeUrl(post.contact) && !isValidEmail(post.contact))) return 'Contact must be a valid email or URL.';
  return '';
}

async function fetchJson(url, label) {
  return fetchJsonRequest(url, label);
}

async function fetchJsonRequest(url, label, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'user-agent': 'HOLLER.WORKS seed bot (+https://holler.works)',
      accept: 'application/json, text/plain, */*',
      ...(options.headers || {}),
    },
    body: options.body,
  });
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
  return response.json();
}

async function fetchText(url, label, headers = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
  return response.text();
}

async function fetchBrowserHtml(page, url, label) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  const html = await page.content();
  if (html.includes('challenge-container') && html.includes('AwsWafIntegration')) {
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
    return page.content();
  }
  return html;
}

function buildUrlWithParams(baseUrl, params = {}) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item !== undefined && item !== null && item !== '') url.searchParams.append(key, String(item));
      });
      return;
    }
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function extractNextData(html, label) {
  const match = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) {
    throw new Error(`${label} did not include __NEXT_DATA__.`);
  }
  return JSON.parse(match[1]);
}

function formatGetroCompensation(job) {
  const minCents = Number(job.compensationAmountMinCents || 0);
  const maxCents = Number(job.compensationAmountMaxCents || 0);
  const currency = String(job.compensationCurrency || 'USD').toUpperCase();
  const period = String(job.compensationPeriod || '').toLowerCase();

  if (!minCents && !maxCents) return '';

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  const min = minCents ? formatter.format(minCents / 100) : '';
  const max = maxCents ? formatter.format(maxCents / 100) : '';
  const range = [min, max].filter(Boolean).join(' - ');

  const intervalMap = {
    year: ' / year',
    hourly: ' / hour',
    hour: ' / hour',
    month: ' / month',
    week: ' / week',
    day: ' / day',
  };

  const interval = intervalMap[period.replace('period_', '')] || '';
  return `${range}${interval}`.trim();
}

function normalizeGetroWorkMode(value) {
  const mode = String(value || '').toLowerCase();
  if (mode === 'remote') return true;
  if (mode === 'hybrid') return true;
  return false;
}

function buildGetroJobDetailUrl(boardUrl, organizationSlug, jobSlug) {
  const board = new URL(boardUrl);
  board.pathname = `/companies/${organizationSlug}/jobs/${jobSlug}`;
  board.hash = 'content';
  board.search = '';
  return board.toString();
}

function formatWorkableLocation(location) {
  if (!location || typeof location !== 'object') return '';
  return normalizeWhitespace(
    [location.city, location.region, location.country]
      .filter(Boolean)
      .join(', ')
  );
}

function extractWorkableLocation(detail) {
  const locations = Array.isArray(detail?.locations) && detail.locations.length
    ? detail.locations
    : (detail?.location ? [detail.location] : []);
  const text = [...new Set(locations.map(formatWorkableLocation).filter(Boolean))].join(' | ');
  if (text) return text;
  if (detail?.remote || String(detail?.workplace || '').toLowerCase() === 'remote') return 'Remote';
  return '';
}

function buildWorkableJobUrl(accountName, shortcode) {
  return `https://apply.workable.com/${accountName}/j/${shortcode}/`;
}

function formatPrimePayCompensation(detailHtml) {
  const match = String(detailHtml || '').match(/JobSalary" data-react-props="([^"]+)"/i);
  if (!match) return '';

  try {
    const payload = JSON.parse(decodeHtmlEntities(match[1]));
    const minAmount = Number(payload?.minSalary?.amount || 0);
    const maxAmount = Number(payload?.maxSalary?.amount || 0);
    const currency = String(payload?.minSalary?.currency || payload?.maxSalary?.currency || 'USD').toUpperCase();
    const intervalMap = {
      annually: ' / year',
      yearly: ' / year',
      monthly: ' / month',
      weekly: ' / week',
      daily: ' / day',
      hourly: ' / hour',
    };
    const interval = intervalMap[String(payload?.payFrequency || '').toLowerCase()] || '';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    const min = minAmount ? formatter.format(minAmount) : '';
    const max = maxAmount ? formatter.format(maxAmount) : '';
    const range = [min, max].filter(Boolean).join(' - ');
    return `${range}${interval}`.trim();
  } catch {
    return '';
  }
}

function extractBetween(text, startMarker, endMarker) {
  const textValue = String(text || '');
  const startIndex = startMarker ? textValue.indexOf(startMarker) : 0;
  if (startMarker && startIndex === -1) return '';
  const begin = startMarker ? startIndex + startMarker.length : 0;
  const tail = textValue.slice(begin);
  const endIndex = endMarker ? tail.indexOf(endMarker) : -1;
  return normalizeStructuredText(endIndex === -1 ? tail : tail.slice(0, endIndex));
}

function extractHtmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>(.*?)<\/title>/is);
  return match ? normalizeWhitespace(decodeHtmlEntities(stripHtml(match[1]))) : '';
}

function extractVirginiaTechLocation(text, title) {
  const htmlTitle = extractHtmlTitle(text);
  if (htmlTitle) {
    const tail = htmlTitle.startsWith(`${title} - `)
      ? htmlTitle.slice(title.length + 3)
      : htmlTitle;
    const titleLocations = tail
      .split(' - ')
      .map(cleanupDescriptionLine)
      .filter(line => /(, Virginia\b|Remote, Virginia\b|Hybrid, Virginia\b|Fully Remote, Virginia\b)/i.test(line));
    if (titleLocations.length) {
      return [...new Set(titleLocations)].join(' | ');
    }
  }

  const lines = stripHtml(text)
    .split('\n')
    .map(cleanupDescriptionLine)
    .filter(Boolean);
  const titleIndex = lines.findIndex(line => (
    line === title
    || line.includes(`${title} - `)
    || line.includes(` ${title}`)
  ));
  if (titleIndex === -1) return '';

  const locations = [];
  for (let index = titleIndex + 1; index < Math.min(lines.length, titleIndex + 10); index += 1) {
    const line = lines[index];
    if (!line) continue;
    if (
      line === 'Add to favorites'
      || line === 'View favorites'
      || line === 'Job Description'
      || line === 'Description'
      || line === 'Qualifications'
      || /^\d{5,}$/.test(line)
      || /(Administrative & Professional|Staff|Faculty|Wage|Student|Vice President|Department)/i.test(line)
    ) {
      break;
    }
    if (/(, Virginia\b|Remote, Virginia\b|Hybrid, Virginia\b|Fully Remote, Virginia\b)/i.test(line)) {
      locations.push(line);
    }
  }

  return [...new Set(locations)].join(' | ');
}

function extractVirginiaTechDescription(html, title) {
  const text = stripHtml(html);
  let section = extractBetween(text, 'Job Description', 'About Virginia Tech');
  if (!section) section = extractBetween(text, title, 'About Virginia Tech');
  if (!section) return '';
  section = section
    .replace(/^Job Description\s*/i, '')
    .replace(/\bSalary Information\b[\s\S]*$/i, '')
    .replace(/\bHours per week\b[\s\S]*$/i, '')
    .trim();
  return extractRelevantDescription(section, title);
}

function extractVirginiaTechCompensation(html) {
  const text = stripHtml(html);
  const salarySection = extractBetween(text, 'Salary Information', 'Hours per week')
    || extractBetween(text, 'Salary Information', 'Review Date')
    || extractBetween(text, 'Salary Information', 'Additional Information')
    || '';
  return extractCompensation(salarySection, text);
}

function extractPeopleAdminListingLinks(html, baseUrl) {
  const pattern = /<a[^>]+href="([^"]*\/postings\/\d+)"[^>]*>(.*?)<\/a>/gsi;
  const jobs = [];
  const seen = new Set();
  let match = pattern.exec(String(html || ''));
  while (match) {
    const href = decodeHtmlEntities(match[1]);
    const title = normalizeWhitespace(stripHtml(match[2]));
    const url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    if (
      title
      && title !== 'View Details'
      && title !== 'Search Jobs'
      && !seen.has(url)
    ) {
      seen.add(url);
      jobs.push({ title, url });
    }
    match = pattern.exec(String(html || ''));
  }
  return jobs;
}

function extractAtomEntries(xmlText) {
  const entries = [];
  const pattern = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match = pattern.exec(String(xmlText || ''));
  while (match) {
    const entryXml = match[1];
    const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = entryXml.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i)
      || entryXml.match(/<link[^>]+href="([^"]+)"/i);
    const title = normalizeWhitespace(stripHtml(decodeHtmlEntities(titleMatch?.[1] || '')));
    const url = normalizeWhitespace(decodeHtmlEntities(linkMatch?.[1] || ''));
    if (title && url && !title.toLowerCase().includes('no positions currently open')) {
      entries.push({ title, url });
    }
    match = pattern.exec(String(xmlText || ''));
  }
  return entries;
}

function extractPeopleAdminLocation(text) {
  const normalized = stripHtml(text);
  const patterns = [
    /Work Location\s+(.+?)(?:\n(?:Qualifications|Required Qualifications|Salary Range|Salary Type|Time Type|Department|Job Description)\b|$)/is,
    /Location\s+(.+?)(?:\n(?:Qualifications|Required Qualifications|Salary Range|Salary Type|Time Type|Department|Job Description)\b|$)/is,
    /Work Location\s+([^\n]+)/i,
    /Location\s+([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const value = cleanupDescriptionLine(match[1]);
      if (value && value.toLowerCase() !== 'n/a') return value;
    }
  }
  return '';
}

function extractPeopleAdminDepartment(text) {
  const normalized = stripHtml(text);
  const match = normalized.match(/Department\s+(.+?)(?:\n(?:Job Description|Position Summary Information|Position Summary|Primary Purpose)\b|$)/is);
  if (match?.[1]) return cleanupDescriptionLine(match[1]);
  return '';
}

function extractPeopleAdminDescription(html, title) {
  const text = stripHtml(html);
  let section = extractBetween(text, 'Job Description', 'Minimum Qualifications')
    || extractBetween(text, 'Job Description', 'Required Qualifications')
    || extractBetween(text, 'Job Description', 'Salary Range')
    || extractBetween(text, 'Position Summary', 'Minimum Qualifications')
    || extractBetween(text, 'Primary Purpose', 'Essential Duties and Responsibilities')
    || extractBetween(text, 'Primary Purpose', 'Minimum Qualifications')
    || '';
  if (!section) section = extractBetween(text, title, 'Salary Range');
  return extractRelevantDescription(section, title);
}

function extractPeopleAdminCompensation(html) {
  const text = stripHtml(html);
  const salarySection = extractBetween(text, 'Salary Range', 'Physical Demands of Position')
    || extractBetween(text, 'Salary Range', 'Posting Details Information')
    || extractBetween(text, 'Salary Range', 'Required Qualifications')
    || extractBetween(text, 'Salary Range', 'Minimum Qualifications')
    || extractBetween(text, 'Salary Range', 'Open Until Filled')
    || '';
  const explicit = extractCompensation(salarySection, text);
  if (explicit) return explicit.replace(/,\s*$/, '');
  const match = salarySection.match(/(\d[\d,]*(?:\.\d+)?\s*(?:-|to|–|—)\s*\d[\d,]*(?:\.\d+)?)/);
  if (match) {
    return `$${match[1].replace(/\s*(?:-|to|–|—)\s*/, ' - $').replace(/^/, '')}`.replace('$', '$');
  }
  const single = salarySection.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (single) return `$${single[1]}`;
  return '';
}

function extractPageUpListingLinks(html, baseUrl) {
  const pattern = /<a[^>]+href="([^"]*\/jobs\/[^"]+)"[^>]*>(.*?)<\/a>/gsi;
  const jobs = [];
  const seen = new Set();
  let match = pattern.exec(String(html || ''));
  while (match) {
    const href = decodeHtmlEntities(match[1]);
    const title = normalizeWhitespace(stripHtml(match[2]));
    const url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    if (
      title
      && title !== 'Read more'
      && !title.toLowerCase().includes('skip to jobs search results')
      && !seen.has(url)
    ) {
      seen.add(url);
      jobs.push({ title, url });
    }
    match = pattern.exec(String(html || ''));
  }
  return jobs;
}

function extractPageUpLocation(text) {
  const normalized = stripHtml(text);
  const match = normalized.match(/Location:\s+(.+?)(?:\n(?:Work Authorization|Job Description|Description|Department Contact Name|Department:|Clery Statement)\b|$)/is);
  if (match?.[1]) return cleanupDescriptionLine(match[1]);
  return '';
}

function extractPageUpDepartment(text) {
  const normalized = stripHtml(text);
  const match = normalized.match(/Department:\s+(.+?)(?:\n(?:Salary:|Department Contact Name|Location:|Job Description|Description)\b|$)/is);
  if (match?.[1]) return cleanupDescriptionLine(match[1]);
  return '';
}

function extractPageUpDescription(html, title) {
  const text = stripHtml(html);
  let section = extractBetween(text, 'Job Description', 'Required Qualifications')
    || extractBetween(text, 'Job Description', 'Minimum Qualifications')
    || extractBetween(text, 'Job Description', 'Department Contact Name')
    || extractBetween(text, 'Description', 'Required Qualifications')
    || extractBetween(text, 'Description', 'Minimum Qualifications')
    || extractBetween(text, 'Description', 'Department Contact Name')
    || '';
  if (!section) section = extractBetween(text, title, 'Department Contact Name');
  return extractRelevantDescription(section, title);
}

function extractPageUpCompensation(html) {
  const text = stripHtml(html);
  const salarySection = extractBetween(text, 'Salary:', 'Department Contact Name')
    || extractBetween(text, 'Salary:', 'Equal Opportunity Statement')
    || extractBetween(text, 'Salary', 'Department Contact Name')
    || '';
  return extractCompensation(salarySection, text);
}

async function fetchWorkdayJson(pageUrl, apiUrl, label, options = {}) {
  const origin = new URL(pageUrl).origin;
  const pageResponse = await fetch(pageUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!pageResponse.ok) {
    throw new Error(`${label} page bootstrap failed with ${pageResponse.status}`);
  }

  const response = await fetch(apiUrl, {
    method: options.method || 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'application/json, text/plain, */*',
      origin,
      referer: pageUrl,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
  });
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
  return response.json();
}

function extractWorkdayLocation(detail) {
  const info = detail?.jobPostingInfo || {};
  return normalizeWhitespace(
    [info.location, ...(Array.isArray(info.additionalLocations) ? info.additionalLocations : [])]
      .filter(Boolean)
      .join(' | ')
  );
}

function extractWorkdayDescription(detail, title) {
  const description = detail?.jobPostingInfo?.jobDescription || '';
  return extractRelevantDescription(description, title);
}

function extractWorkdayCompensation(detail) {
  const info = detail?.jobPostingInfo || {};
  return extractCompensation(
    info.jobDescription || '',
    info.additionalJobDescription || '',
    JSON.stringify(detail || {})
  );
}

async function fetchPcsJson(pageUrl, apiUrl, label) {
  const origin = new URL(pageUrl).origin;
  const response = await fetch(apiUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'application/json, text/plain, */*',
      origin,
      referer: pageUrl,
    },
  });
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
  return response.json();
}

function extractPcsLocations(detail) {
  return normalizeWhitespace(
    [
      ...(Array.isArray(detail?.standardizedLocations) ? detail.standardizedLocations : []),
      ...(Array.isArray(detail?.locations) ? detail.locations : []),
    ]
      .filter(Boolean)
      .join(' | ')
  );
}

function extractPcsCompensation(detail) {
  return extractCompensation(
    detail?.jobDescription || '',
    detail?.salaryRange || '',
    JSON.stringify(detail || {})
  );
}

function isPcsRemoteFriendly(detail) {
  const mode = String(detail?.workLocationOption || detail?.locationFlexibility || '').toLowerCase();
  return mode === 'remote' || mode === 'hybrid';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectJsonLdNodes(value) {
  if (Array.isArray(value)) return value.flatMap(collectJsonLdNodes);
  if (!value || typeof value !== 'object') return [];
  const nodes = [value];
  if (Array.isArray(value['@graph'])) {
    nodes.push(...value['@graph'].flatMap(collectJsonLdNodes));
  }
  return nodes;
}

function extractJsonLdObjects(html) {
  const nodes = [];
  const pattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match = pattern.exec(String(html || ''));
  while (match) {
    const candidate = match[1].trim();
    if (!candidate) {
      match = pattern.exec(String(html || ''));
      continue;
    }
    try {
      nodes.push(...collectJsonLdNodes(JSON.parse(candidate)));
    } catch {
      try {
        nodes.push(...collectJsonLdNodes(JSON.parse(decodeHtmlEntities(candidate))));
      } catch {
        // Ignore malformed JSON-LD blocks and keep scanning.
      }
    }
    match = pattern.exec(String(html || ''));
  }
  return nodes;
}

function extractHtmlLabeledValue(html, label) {
  const pattern = new RegExp(`<strong>\\s*${escapeRegExp(label)}\\s*<\\/strong>\\s*([^<]+)`, 'i');
  const match = String(html || '').match(pattern);
  return normalizeWhitespace(decodeHtmlEntities(stripHtml(match?.[1] || '')));
}

function formatCurrencyAmount(value, currency = 'USD') {
  if (!Number.isFinite(value) || value <= 0) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function extractDicksListingLinks(html, baseUrl) {
  const jobs = [];
  const seen = new Set();
  const pattern = /<a[^>]+href="([^"]*\/job\/[^"]+\/\d+\/?)"[^>]*>/gsi;
  let match = pattern.exec(String(html || ''));
  while (match) {
    const href = decodeHtmlEntities(match[1]);
    const url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    if (!seen.has(url)) {
      seen.add(url);
      jobs.push(url);
    }
    match = pattern.exec(String(html || ''));
  }
  return jobs;
}

function extractDicksJobDetail(html, detailUrl, source) {
  const jsonLd = extractJsonLdObjects(html);
  const jobPosting = jsonLd.find(node => String(node?.['@type'] || '').toLowerCase() === 'jobposting') || {};
  const salary = jobPosting?.baseSalary || {};
  const salaryValue = salary?.value || {};
  const minValue = Number(salaryValue?.minValue || 0);
  const maxValue = Number(salaryValue?.maxValue || 0);
  const title = normalizeWhitespace(
    jobPosting?.title
    || extractHtmlLabeledValue(html, 'Role:')
    || normalizeWhitespace(decodeHtmlEntities(stripHtml(String(html || '').match(/<h1[^>]*>\s*<strong>(.*?)<\/strong>/is)?.[1] || '')))
  );
  const rawLocation = normalizeWhitespace(
    extractHtmlLabeledValue(html, 'City, State:')
    || extractHtmlLabeledValue(html, 'Location:')
    || jobPosting?.jobLocation?.address?.addressLocality
    || ''
  );
  const compensation = (
    (minValue || maxValue)
      ? [formatCurrencyAmount(minValue, salary.currency || 'USD'), formatCurrencyAmount(maxValue, salary.currency || 'USD')]
        .filter(Boolean)
        .join(' - ')
      : ''
  ) || extractCompensation(salary?._rawText || salary?._sourceSnippet || '', html);
  const jobId = normalizeWhitespace(
    extractHtmlLabeledValue(html, 'Job ID:')
    || String(jobPosting?.identifier?.value || '')
    || String(detailUrl.match(/\/(\d+)\/?$/)?.[1] || '')
  );
  const department = normalizeWhitespace(
    [
      extractHtmlLabeledValue(html, 'Job Category:'),
      extractHtmlLabeledValue(html, 'Brand:'),
    ].filter(Boolean).join(' / ')
  );
  const contact = normalizeWhitespace(
    decodeHtmlEntities(String(html.match(/class="page_apply_link[^"]*"[^>]*href="([^"]+)"/i)?.[1] || ''))
  );
  const descriptionHtml = jobPosting?.description
    || String(html.match(/<div class="Desc__copy">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/i)?.[1] || '');

  return {
    title,
    description: extractRelevantDescription(descriptionHtml, title),
    contact,
    rawLocation,
    compensation,
    companyName: source.companyName || '',
    companyWebsite: source.companyWebsite || '',
    department,
    sourceUrl: detailUrl,
    sourceId: jobId,
    remoteFriendly: looksRemote(rawLocation, title, descriptionHtml),
  };
}

function buildTalentBrewPageUrl(searchUrl, pageNo, pageParam = 'p') {
  if (pageNo <= 1) return searchUrl;
  return buildUrlWithParams(searchUrl, {
    [pageParam]: String(pageNo),
  });
}

function extractTalentBrewListingLinks(html, baseUrl) {
  const jobs = [];
  const seen = new Set();
  const pattern = /<a[^>]+href="([^"]*\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gsi;
  let match = pattern.exec(String(html || ''));
  while (match) {
    const href = decodeHtmlEntities(match[1]);
    const inner = match[2] || '';
    const url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    const title = normalizeWhitespace(
      stripHtml(String(inner.match(/<span[^>]*class="[^"]*job-title[^"]*"[^>]*>(.*?)<\/span>/is)?.[1] || ''))
    );
    const rawLocation = normalizeWhitespace(
      stripHtml(String(inner.match(/<span[^>]*class="[^"]*job-location[^"]*"[^>]*>(.*?)<\/span>/is)?.[1] || ''))
    );
    const sourceId = normalizeWhitespace(
      String(inner.match(/<span[^>]*class="[^"]*job-id[^"]*"[^>]*>.*?Job ID:\s*(.*?)<\/span>/is)?.[1] || '')
      || String(url.match(/\/(\d+)\/?$/)?.[1] || '')
    );
    if (
      title
      && !title.toLowerCase().includes('skip to main content')
      && !seen.has(url)
    ) {
      seen.add(url);
      jobs.push({
        title,
        rawLocation,
        sourceId,
        url,
      });
    }
    match = pattern.exec(String(html || ''));
  }
  return jobs;
}

function extractTalentBrewLocation(jobPosting = {}) {
  const locations = Array.isArray(jobPosting?.jobLocation)
    ? jobPosting.jobLocation
    : (jobPosting?.jobLocation ? [jobPosting.jobLocation] : []);
  const text = locations.map(location => {
    const address = location?.address || {};
    return normalizeWhitespace([
      address.addressLocality,
      address.addressRegion,
      address.addressCountry,
    ].filter(Boolean).join(', '));
  }).filter(Boolean).join(' | ');
  return normalizeWhitespace(text);
}

function extractTalentBrewDepartment(html) {
  const sections = [
    extractHtmlLabeledValue(html, 'Business Unit:'),
    extractHtmlLabeledValue(html, 'Relocation Available:'),
    extractHtmlLabeledValue(html, 'Career Area:'),
  ].filter(Boolean);
  return normalizeWhitespace(sections.join(' / '));
}

function extractTalentBrewJobDetail(html, detailUrl, source, listingJob = {}) {
  const jsonLd = extractJsonLdObjects(html);
  const jobPosting = jsonLd.find(node => String(node?.['@type'] || '').toLowerCase() === 'jobposting') || {};
  const title = normalizeWhitespace(
    String(jobPosting?.title || '')
      .replace(/^\*+\s*/, '')
      || normalizeWhitespace(stripHtml(String(html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1] || '')))
      || listingJob.title
  );
  const descriptionHtml = jobPosting?.description
    || String(html.match(/<section[^>]*id="anchor-overview"[\s\S]*?<div[^>]*class="max-width-wrapper"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i)?.[1] || '');
  const rawLocation = normalizeWhitespace(
    extractTalentBrewLocation(jobPosting)
    || listingJob.rawLocation
    || normalizeWhitespace(stripHtml(String(html.match(/<span[^>]*class="[^"]*job-location[^"]*"[^>]*>(.*?)<\/span>/is)?.[1] || '')))
  );
  const contact = normalizeWhitespace(
    decodeHtmlEntities(
      String(
        html.match(/class="[^"]*job-apply[^"]*"[^>]*href="([^"]+)"/i)?.[1]
        || html.match(/data-apply-url="([^"]+)"/i)?.[1]
        || ''
      )
    )
  );
  const compensation = extractCompensation(
    JSON.stringify(jobPosting || {}),
    descriptionHtml,
    html
  );
  const sourceId = normalizeWhitespace(
    listingJob.sourceId
    || String(jobPosting?.identifier?.value || '')
    || String(detailUrl.match(/\/(\d+)\/?$/)?.[1] || '')
  );

  return {
    title,
    description: extractRelevantDescription(descriptionHtml, title),
    contact: contact || detailUrl,
    rawLocation,
    compensation,
    companyName: source.companyName || '',
    companyWebsite: source.companyWebsite || '',
    department: extractTalentBrewDepartment(html),
    sourceUrl: detailUrl,
    sourceId,
    remoteFriendly: looksRemote(rawLocation, title, descriptionHtml),
  };
}

function extractVirginiaTechPageJobs(html, source) {
  const linkPattern = /<a[^>]+href="([^"]*\/jobs\/[^"]+)"[^>]*>(.*?)<\/a>/gsi;
  const jobs = [];
  const seen = new Set();
  let match = linkPattern.exec(html);
  while (match) {
    const href = decodeHtmlEntities(match[1]);
    const title = normalizeWhitespace(stripHtml(match[2]));
    const absoluteUrl = href.startsWith('http') ? href : new URL(href, source.searchUrl).toString();
    if (
      title
      && title !== 'Read more'
      && title !== 'Search Jobs'
      && !seen.has(absoluteUrl)
    ) {
      seen.add(absoluteUrl);
      jobs.push({ title, url: absoluteUrl });
    }
    match = linkPattern.exec(html);
  }
  return jobs;
}

async function loadSourceJobs(source, configPath) {
  if (source.type === 'greenhouse') {
    if (!source.boardToken) throw new Error(`Source "${source.name}" is missing boardToken.`);
    const payload = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${source.boardToken}/jobs?content=true`, source.name);
    return (payload.jobs || []).map(job => ({
      title: job.title || '',
        description: extractRelevantDescription(job.content || '', job.title || ''),
      contact: job.absolute_url || '',
      rawLocation: job.location?.name || '',
      compensation: extractCompensation(job.content || ''),
      companyName: source.companyName || '',
      companyWebsite: source.companyWebsite || '',
      department: Array.isArray(job.departments) ? job.departments.map(item => item.name).join(' / ') : '',
      sourceUrl: job.absolute_url || '',
      sourceId: String(job.id || ''),
      remoteFriendly: looksRemote(job.title, job.content, job.location?.name),
    }));
  }

  if (source.type === 'lever') {
    if (!source.accountName) throw new Error(`Source "${source.name}" is missing accountName.`);
    const payload = await fetchJson(`https://api.lever.co/v0/postings/${source.accountName}?mode=json`, source.name);
    return (payload || []).map(job => {
      const listsText = Array.isArray(job.lists)
        ? job.lists
          .map(list => `${list.text || ''} ${Array.isArray(list.content) ? list.content.map(item => item.text || '').join(' ') : ''}`)
          .join(' ')
        : '';
      return {
        title: job.text || '',
        description: extractRelevantDescription([
          job.descriptionPlain || job.description || '',
          job.additionalPlain || job.additional || '',
          listsText,
        ].filter(Boolean).join('\n\n'), job.text || ''),
        contact: job.hostedUrl || job.applyUrl || '',
        rawLocation: job.categories?.location || '',
        compensation: normalizeWhitespace(job.salaryDescription || extractCompensation(job.descriptionPlain, job.additionalPlain, listsText)),
        companyName: source.companyName || '',
        companyWebsite: source.companyWebsite || '',
        department: [job.categories?.team, job.categories?.department, job.categories?.commitment].filter(Boolean).join(' / '),
        sourceUrl: job.hostedUrl || '',
        sourceId: String(job.id || ''),
        remoteFriendly: looksRemote(job.text, job.workplaceType, job.categories?.location, job.descriptionPlain),
      };
    });
  }

  if (source.type === 'json-file') {
    if (!source.file) throw new Error(`Source "${source.name}" is missing file.`);
    const filePath = path.resolve(path.dirname(configPath), source.file);
    const payload = await readJson(filePath);
    if (!Array.isArray(payload)) throw new Error(`Source "${source.name}" file must contain an array.`);
    return payload.map(item => ({
      title: item.title || '',
      description: extractRelevantDescription(item.description || item.body || '', item.title || ''),
      contact: item.contact || item.applyUrl || '',
      rawLocation: item.rawLocation || item.location || '',
      compensation: item.compensation || item.salary || '',
      companyName: item.companyName || item.company || source.companyName || '',
      companyWebsite: item.companyWebsite || item.company_url || source.companyWebsite || '',
      department: item.department || item.team || '',
      sourceUrl: item.sourceUrl || item.applyUrl || '',
      sourceId: String(item.id || item.sourceId || ''),
      remoteFriendly: Boolean(item.remoteFriendly || item.remote),
      locationState: item.locationState || source.locationState || '',
      locationRegion: item.locationRegion || source.locationRegion || '',
      locationCity: item.locationCity || '',
      locationNotes: item.locationNotes || source.locationNotes || '',
    }));
  }

  if (source.type === 'ashby') {
    if (!source.jobBoardName) throw new Error(`Source "${source.name}" is missing jobBoardName.`);
    const payload = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${source.jobBoardName}?includeCompensation=true`, source.name);
    return (payload.jobs || []).map(job => {
      const comp = job.compensation || {};
      const secondaryLocations = Array.isArray(job.secondaryLocations)
        ? job.secondaryLocations.map(item => item?.location).filter(Boolean)
        : [];
      const compText = normalizeWhitespace(
        comp.scrapeableCompensationSalarySummary
        || comp.compensationTierSummary
        || (
          Array.isArray(comp.summaryComponents) && comp.summaryComponents.length
            ? comp.summaryComponents
              .map(item => {
                if (item.minValue || item.maxValue) {
                  const min = item.minValue ? `$${Number(item.minValue).toLocaleString()}` : '';
                  const max = item.maxValue ? `$${Number(item.maxValue).toLocaleString()}` : '';
                  const range = [min, max].filter(Boolean).join(' - ');
                  const interval = item.interval ? ` per ${String(item.interval).toLowerCase().replace('_', ' ')}` : '';
                  return `${range}${interval}`.trim();
                }
                return '';
              })
              .filter(Boolean)
              .join('; ')
            : ''
        )
      );
      return {
        title: job.title || '',
        description: extractRelevantDescription(job.descriptionPlain || job.descriptionHtml || '', job.title || ''),
        contact: job.jobUrl || job.applyUrl || '',
        rawLocation: [job.location, ...secondaryLocations].filter(Boolean).join(' | '),
        compensation: compText,
        companyName: source.companyName || '',
        companyWebsite: source.companyWebsite || '',
        department: [job.department, job.team, job.employmentType].filter(Boolean).join(' / '),
        sourceUrl: job.jobUrl || '',
        sourceId: String(job.id || ''),
        remoteFriendly: Boolean(job.isRemote || looksRemote(job.location, job.workplaceType, job.title)),
      };
    });
  }

  if (source.type === 'workable') {
    if (!source.accountName) throw new Error(`Source "${source.name}" is missing accountName.`);
    const payload = await fetchJsonRequest(
      `https://apply.workable.com/api/v3/accounts/${source.accountName}/jobs`,
      source.name,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(source.requestBody || {
          query: '',
          department: [],
          location: [],
          workplace: [],
          worktype: [],
        }),
      }
    );
    const jobs = Array.isArray(payload.results) ? payload.results : [];
    const detailJobs = await Promise.all(
      jobs.map(async job => {
        const shortcode = String(job.shortcode || '');
        if (!shortcode) return null;
        const detail = await fetchJson(
          `https://apply.workable.com/api/v2/accounts/${source.accountName}/jobs/${shortcode}`,
          `${source.name} detail ${shortcode}`
        );
        const rawLocation = extractWorkableLocation(detail);
        const description = extractRelevantDescription(detail.description || '', detail.title || job.title || '');
        return {
          title: detail.title || job.title || '',
          description,
          contact: buildWorkableJobUrl(source.accountName, shortcode),
          rawLocation,
          compensation: extractCompensation(detail.description || '', detail.title || '', rawLocation),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: Array.isArray(detail.department) ? detail.department.join(' / ') : '',
          sourceUrl: buildWorkableJobUrl(source.accountName, shortcode),
          sourceId: shortcode || String(detail.id || job.id || ''),
          remoteFriendly: Boolean(
            detail.remote
            || String(detail.workplace || '').toLowerCase() === 'remote'
            || looksRemote(rawLocation, detail.title, description)
          ),
        };
      })
    );
    return detailJobs.filter(Boolean);
  }

  if (source.type === 'workday') {
    if (!source.pageUrl || !source.apiBaseUrl) {
      throw new Error(`Source "${source.name}" is missing pageUrl or apiBaseUrl.`);
    }
    const requestLimit = Number(source.requestLimit || 20);
    const requestOffsets = Array.isArray(source.requestOffsets) && source.requestOffsets.length
      ? source.requestOffsets.map(value => Number(value || 0))
      : [Number(source.requestOffset || 0)];
    const jobsByPath = new Map();
    for (const offset of requestOffsets) {
      const listing = await fetchWorkdayJson(
        source.pageUrl,
        `${source.apiBaseUrl}/jobs?page=0`,
        `${source.name} offset ${offset}`,
        {
          method: 'POST',
          body: JSON.stringify({
            limit: requestLimit,
            offset,
            ...(source.requestBody || {}),
          }),
        }
      );
      const jobs = Array.isArray(listing.jobPostings) ? listing.jobPostings : [];
      jobs.forEach(job => {
        const pathValue = String(job.externalPath || '').trim();
        if (pathValue && !jobsByPath.has(pathValue)) {
          jobsByPath.set(pathValue, job);
        }
      });
    }
    const requestDelayMs = Number(source.requestDelayMs || 150);
    const detailJobs = [];

    for (const job of jobsByPath.values()) {
      const pathValue = String(job.externalPath || '').trim();
      if (!pathValue) continue;
      try {
        const detail = await fetchWorkdayJson(
          source.pageUrl,
          `${source.apiBaseUrl}${pathValue}`,
          `${source.name} detail ${job.title || pathValue}`
        );
        detailJobs.push({
          title: job.title || detail?.jobPostingInfo?.title || '',
          description: extractWorkdayDescription(detail, job.title || ''),
          contact: `${source.pageUrl.replace(/\/$/, '')}${pathValue}`,
          rawLocation: extractWorkdayLocation(detail) || job.locationsText || '',
          compensation: extractWorkdayCompensation(detail),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: normalizeWhitespace([
            detail?.jobPostingInfo?.jobFamily,
            detail?.jobPostingInfo?.timeType,
          ].filter(Boolean).join(' / ')),
          sourceUrl: `${source.apiBaseUrl}${pathValue}`,
          sourceId: String(detail?.jobPostingInfo?.jobReqId || pathValue),
          remoteFriendly: looksRemote(
            job.locationsText,
            detail?.jobPostingInfo?.location,
            Array.isArray(detail?.jobPostingInfo?.additionalLocations)
              ? detail.jobPostingInfo.additionalLocations.join(' ')
              : '',
            detail?.jobPostingInfo?.jobDescription
          ),
        });
      } catch {
        continue;
      }
      if (requestDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, requestDelayMs));
      }
    }

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'pcs') {
    if (!source.pageUrl || !source.apiBaseUrl || !source.domain) {
      throw new Error(`Source "${source.name}" is missing pageUrl, apiBaseUrl, or domain.`);
    }
    const requestStarts = Array.isArray(source.requestStarts) && source.requestStarts.length
      ? source.requestStarts.map(value => Number(value || 0))
      : [Number(source.requestStart || 0)];
    const requestDelayMs = Number(source.requestDelayMs || 150);
    const positionsById = new Map();

    for (const start of requestStarts) {
      const searchUrl = buildUrlWithParams(`${source.apiBaseUrl}/search`, {
        domain: source.domain,
        query: source.query || '',
        location: source.location || '',
        start,
      });
      const payload = await fetchPcsJson(source.pageUrl, searchUrl, `${source.name} start ${start}`);
      const positions = Array.isArray(payload?.data?.positions) ? payload.data.positions : [];
      positions.forEach(position => {
        const id = String(position?.id || '').trim();
        if (id && !positionsById.has(id)) {
          positionsById.set(id, position);
        }
      });
    }

    const detailJobs = [];
    for (const position of positionsById.values()) {
      const positionId = String(position?.id || '').trim();
      if (!positionId) continue;
      try {
        const detailUrl = buildUrlWithParams(`${source.apiBaseUrl}/position_details`, {
          position_id: positionId,
          domain: source.domain,
          hl: source.locale || 'en',
        });
        const payload = await fetchPcsJson(
          source.pageUrl,
          detailUrl,
          `${source.name} detail ${position.displayJobId || positionId}`
        );
        const detail = payload?.data || {};
        const sourceUrl = new URL(
          detail?.positionUrl || position?.positionUrl || `/careers/job/${positionId}`,
          source.pageUrl
        ).toString();
        const rawLocation = extractPcsLocations(detail) || extractPcsLocations(position);
        const description = detail?.jobDescription || '';
        detailJobs.push({
          title: detail?.name || position?.name || '',
          description: extractRelevantDescription(description, detail?.name || position?.name || ''),
          contact: sourceUrl,
          rawLocation,
          compensation: extractPcsCompensation(detail),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: detail?.department || position?.department || '',
          sourceUrl,
          sourceId: String(detail?.displayJobId || position?.displayJobId || positionId),
          remoteFriendly: Boolean(
            isPcsRemoteFriendly(detail)
            || isPcsRemoteFriendly(position)
            || looksRemote(
              rawLocation,
              Array.isArray(detail?.standardizedLocations) ? detail.standardizedLocations.join(' ') : '',
              Array.isArray(detail?.locations) ? detail.locations.join(' ') : '',
              detail?.name || position?.name || ''
            )
          ),
        });
      } catch {
        continue;
      }
      if (requestDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, requestDelayMs));
      }
    }

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'primepay-recruit') {
    if (!source.accountName) throw new Error(`Source "${source.name}" is missing accountName.`);
    const widgetText = await fetchText(
      `https://${source.accountName}.applicant-tracking.com/api/widget_jobs?src=${source.accountName}`,
      source.name
    );
    const normalized = widgetText.trim().replace(/^\(/, '').replace(/\)$/, '');
    const jobs = JSON.parse(normalized);

    const detailJobs = await Promise.all(
      (Array.isArray(jobs) ? jobs : []).map(async job => {
        const detailUrl = String(job.apply_url || '').trim();
        const detailHtml = detailUrl ? await fetchText(detailUrl, `${source.name} detail ${job.job_id || ''}`) : '';
        return {
          title: job.title || '',
          description: extractRelevantDescription(detailHtml || job.summary || '', job.title || ''),
          contact: detailUrl,
          rawLocation: job.location || '',
          compensation: formatPrimePayCompensation(detailHtml) || extractCompensation(detailHtml, job.summary || ''),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: job.category || '',
          sourceUrl: detailUrl,
          sourceId: String(job.job_id || ''),
          remoteFriendly: looksRemote(job.title, job.location, detailHtml),
        };
      })
    );

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'getro') {
    if (!source.boardUrl) throw new Error(`Source "${source.name}" is missing boardUrl.`);
    const listHtml = await fetchText(source.boardUrl, source.name);
    const listData = extractNextData(listHtml, source.name);
    const listJobs = listData?.props?.pageProps?.initialState?.jobs?.found || [];

    const detailJobs = await Promise.all(
      listJobs.map(async listJob => {
        const organization = listJob.organization || {};
        if (!organization.slug || !listJob.slug) return null;
        const detailUrl = buildGetroJobDetailUrl(source.boardUrl, organization.slug, listJob.slug);
        const detailHtml = await fetchText(detailUrl, `${source.name} detail ${listJob.slug}`);
        const detailData = extractNextData(detailHtml, `${source.name} detail ${listJob.slug}`);
        const currentJob = detailData?.props?.pageProps?.initialState?.jobs?.currentJob;
        if (!currentJob) return null;

        const currentOrg = currentJob.organization || {};
        const orgDomain = normalizeWhitespace(currentOrg.domain || '');
        const companyWebsite = orgDomain ? `https://${orgDomain}` : '';
        const locationNames = Array.isArray(currentJob.locations)
          ? currentJob.locations.map(location => location?.name).filter(Boolean)
          : [];
        const jobFunctions = Array.isArray(currentJob.jobFunctions)
          ? currentJob.jobFunctions.map(item => item?.name || item).filter(Boolean).join(' / ')
          : '';

        return {
          title: currentJob.title || '',
          description: extractRelevantDescription(currentJob.description || '', currentJob.title || ''),
          contact: currentJob.url || '',
          rawLocation: locationNames.join(' | ') || (Array.isArray(listJob.locations) ? listJob.locations.join(' | ') : ''),
          compensation: formatGetroCompensation(currentJob) || extractCompensation(currentJob.description || ''),
          companyName: currentOrg.name || organization.name || source.companyName || '',
          companyWebsite: companyWebsite || source.companyWebsite || '',
          department: jobFunctions,
          sourceUrl: detailUrl,
          sourceId: String(currentJob.id || listJob.id || ''),
          remoteFriendly: normalizeGetroWorkMode(listJob.workMode || currentJob.workMode),
        };
      })
    );

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'dicks-jobs') {
    if (!source.searchUrl) throw new Error(`Source "${source.name}" is missing searchUrl.`);
    const maxPages = Math.max(1, Number(source.maxPages || 1));
    const maxDetailJobs = Number(source.maxDetailJobs || 0);
    const requestDelayMs = Number(source.requestDelayMs || 150);
    const jobsByUrl = new Map();

    for (let pageNo = 0; pageNo < maxPages; pageNo += 1) {
      const pageUrl = pageNo === 0
        ? source.searchUrl
        : buildUrlWithParams(source.searchUrl, { mypage: String(pageNo) });
      const pageHtml = await fetchText(pageUrl, `${source.name} page ${pageNo}`);
      const pageJobs = extractDicksListingLinks(pageHtml, source.searchUrl);
      if (!pageJobs.length) break;
      const countBefore = jobsByUrl.size;
      pageJobs.forEach(url => {
        if (!jobsByUrl.has(url)) jobsByUrl.set(url, url);
      });
      if (pageNo > 0 && jobsByUrl.size === countBefore) break;
    }

    const detailJobs = [];
    const jobsToLoad = [...jobsByUrl.values()];
    const limitedJobs = maxDetailJobs > 0 ? jobsToLoad.slice(0, maxDetailJobs) : jobsToLoad;
    for (const detailUrl of limitedJobs) {
      const detailHtml = await fetchText(detailUrl, `${source.name} detail ${detailUrl}`);
      const job = extractDicksJobDetail(detailHtml, detailUrl, source);
      if (job?.title) detailJobs.push(job);
      if (requestDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, requestDelayMs));
      }
    }

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'virginia-tech') {
    if (!source.searchUrl) throw new Error(`Source "${source.name}" is missing searchUrl.`);
    const { chromium } = require('playwright');
    const categoryFilters = Array.isArray(source.categoryFilters) ? source.categoryFilters : [];
    const maxPages = Number(source.maxPages || 1);
    const maxDetailJobs = Number(source.maxDetailJobs || 0);
    const searchParams = source.searchParams || {};
    const jobsByUrl = new Map();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      for (const categoryFilter of categoryFilters) {
        for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
          const pageUrl = buildUrlWithParams(source.searchUrl, {
            ...searchParams,
            page: String(pageNo),
            'category_uids[]': categoryFilter.value,
          });
          const pageHtml = await fetchBrowserHtml(page, pageUrl, `${source.name} ${categoryFilter.name} page ${pageNo}`);
          const pageJobs = extractVirginiaTechPageJobs(pageHtml, source);
          if (!pageJobs.length) break;

          pageJobs.forEach(job => {
            if (!jobsByUrl.has(job.url)) {
              jobsByUrl.set(job.url, { ...job, categoryFilter: categoryFilter.name });
            }
          });
        }
      }

      const detailJobs = [];
      const jobsToLoad = [...jobsByUrl.values()];
      const limitedJobs = maxDetailJobs > 0 ? jobsToLoad.slice(0, maxDetailJobs) : jobsToLoad;
      for (const job of limitedJobs) {
        const detailHtml = await fetchBrowserHtml(page, job.url, `${source.name} detail ${job.title}`);
        const detailText = stripHtml(detailHtml);
        detailJobs.push({
          title: job.title,
          description: extractVirginiaTechDescription(detailHtml, job.title),
          contact: job.url,
          rawLocation: extractVirginiaTechLocation(detailHtml, job.title),
          compensation: extractVirginiaTechCompensation(detailHtml),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: job.categoryFilter || '',
          sourceUrl: job.url,
          sourceId: job.url,
          remoteFriendly: looksRemote(detailText, job.title),
        });
      }

      return detailJobs.filter(Boolean);
    } finally {
      await browser.close();
    }
  }

  if (source.type === 'peopleadmin') {
    if (!source.searchUrl) throw new Error(`Source "${source.name}" is missing searchUrl.`);
    const maxPages = Number(source.maxPages || 1);
    const searchParams = source.searchParams || {};
    const jobsByUrl = new Map();

    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const pageUrl = buildUrlWithParams(source.searchUrl, {
        ...searchParams,
        page: pageNo > 1 ? String(pageNo) : undefined,
      });
      const pageHtml = await fetchText(pageUrl, `${source.name} page ${pageNo}`);
      const pageJobs = extractPeopleAdminListingLinks(pageHtml, source.searchUrl);
      if (!pageJobs.length) break;
      pageJobs.forEach(job => {
        if (!jobsByUrl.has(job.url)) jobsByUrl.set(job.url, job);
      });
    }

    const detailJobs = await Promise.all(
      [...jobsByUrl.values()].map(async job => {
        const detailHtml = await fetchText(job.url, `${source.name} detail ${job.title}`);
        const rawLocation = extractPeopleAdminLocation(detailHtml);
        return {
          title: job.title,
          description: extractPeopleAdminDescription(detailHtml, job.title),
          contact: job.url,
          rawLocation,
          compensation: extractPeopleAdminCompensation(detailHtml),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: extractPeopleAdminDepartment(detailHtml),
          sourceUrl: job.url,
          sourceId: job.url,
          remoteFriendly: looksRemote(rawLocation, job.title),
        };
      })
    );

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'peopleadmin-atom') {
    if (!source.atomUrl) throw new Error(`Source "${source.name}" is missing atomUrl.`);
    const atomXml = await fetchText(source.atomUrl, `${source.name} atom`);
    const atomJobs = extractAtomEntries(atomXml);

    const detailJobs = await Promise.all(
      atomJobs.map(async job => {
        const detailHtml = await fetchText(job.url, `${source.name} detail ${job.title}`);
        const rawLocation = extractPeopleAdminLocation(detailHtml);
        return {
          title: job.title,
          description: extractPeopleAdminDescription(detailHtml, job.title),
          contact: job.url,
          rawLocation,
          compensation: extractPeopleAdminCompensation(detailHtml),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: extractPeopleAdminDepartment(detailHtml),
          sourceUrl: job.url,
          sourceId: job.url,
          remoteFriendly: looksRemote(rawLocation, job.title),
        };
      })
    );

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'talentbrew') {
    if (!source.searchUrl) throw new Error(`Source "${source.name}" is missing searchUrl.`);
    const maxPages = Number(source.maxPages || 1);
    const pageParam = String(source.pageParam || 'p');
    const jobsByUrl = new Map();

    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const pageUrl = buildTalentBrewPageUrl(source.searchUrl, pageNo, pageParam);
      const pageHtml = await fetchText(pageUrl, `${source.name} page ${pageNo}`);
      const pageJobs = extractTalentBrewListingLinks(pageHtml, source.searchUrl);
      if (!pageJobs.length) break;
      pageJobs.forEach(job => {
        if (!jobsByUrl.has(job.url)) jobsByUrl.set(job.url, job);
      });
    }

    const detailJobs = await Promise.all(
      [...jobsByUrl.values()].map(async job => {
        const detailHtml = await fetchText(job.url, `${source.name} detail ${job.title}`);
        return extractTalentBrewJobDetail(detailHtml, job.url, source, job);
      })
    );

    return detailJobs.filter(Boolean);
  }

  if (source.type === 'pageup') {
    const searchUrl = buildUrlWithParams(source.searchUrl, source.searchParams || {});
    const searchHtml = await fetchText(searchUrl, `${source.name} search`);
    const listJobs = extractPageUpListingLinks(searchHtml, source.searchUrl);
    const detailJobs = await Promise.all(
      listJobs.map(async job => {
        const detailHtml = await fetchText(job.url, `${source.name} detail ${job.title}`);
        return {
          title: job.title,
          description: extractPageUpDescription(detailHtml, job.title),
          contact: job.url,
          rawLocation: extractPageUpLocation(detailHtml),
          compensation: extractPageUpCompensation(detailHtml),
          companyName: source.companyName || '',
          companyWebsite: source.companyWebsite || '',
          department: extractPageUpDepartment(detailHtml),
          sourceUrl: job.url,
          sourceId: job.url,
          remoteFriendly: looksRemote(extractPageUpLocation(detailHtml), job.title),
        };
      })
    );
    return detailJobs.filter(Boolean);
  }

  throw new Error(`Unknown source type: ${source.type}`);
}

function normalizeSourceJob(raw, source) {
  const title = normalizeWhitespace(raw.title);
  const description = truncate(raw.description || '');
  const companyName = normalizeWhitespace(raw.companyName || source.companyName);
  const companyWebsite = normalizeUrl(raw.companyWebsite || source.companyWebsite);
  const contact = normalizeUrl(raw.contact || raw.sourceUrl || source.contact) || normalizeWhitespace(raw.contact || '');
  const category = guessCategory(title, raw.department || '', description);
  const compensation = normalizeWhitespace(raw.compensation || source.defaultCompensation || '');
  const locationRuleMatch = applyLocationRules(raw.rawLocation, source.locationRules);
  const remoteFriendly = Boolean(
    raw.remoteFriendly
    || source.remoteFriendly
    || locationRuleMatch?.remoteFriendly
    || looksRemote(raw.rawLocation, title, description)
  );
  const locationState = normalizeWhitespace(raw.locationState || locationRuleMatch?.locationState || source.locationState);
  const locationRegion = normalizeWhitespace(raw.locationRegion || locationRuleMatch?.locationRegion || source.locationRegion);
  const locationCity = normalizeWhitespace(raw.locationCity || locationRuleMatch?.locationCity || inferCity(raw.rawLocation));
  const locationNotes = normalizeWhitespace(raw.locationNotes || locationRuleMatch?.locationNotes || source.locationNotes || '');

  return {
    type: 'need',
    title,
    category,
    companyName,
    companyWebsite,
    locationState,
    locationRegion,
    locationCity: locationCity || undefined,
    locationNotes: locationNotes || undefined,
    compensation,
    description,
    contact,
    remoteFriendly,
    _seedMeta: {
      sourceName: source.name,
      sourceType: source.type,
      sourceUrl: normalizeUrl(raw.sourceUrl || raw.contact),
      sourceId: raw.sourceId || '',
      rawLocation: normalizeWhitespace(raw.rawLocation || ''),
      department: normalizeWhitespace(raw.department || ''),
    },
  };
}

function summarizeReport(report) {
  const lines = [
    `sources processed: ${report.sources.length}`,
    `raw jobs fetched: ${report.rawCount}`,
    `accepted jobs: ${report.accepted.length}`,
    `rejected jobs: ${report.rejected.length}`,
    `final output jobs: ${report.outputCount}`,
    `output path: ${report.outPath}`,
  ];
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const configPath = path.resolve(process.cwd(), options.config);
  const outPath = path.resolve(process.cwd(), options.out);
  const reportPath = path.resolve(process.cwd(), options.report);
  const config = await readJson(configPath);
  const sources = Array.isArray(config.sources) ? config.sources : [];
  if (!sources.length) throw new Error('Config must include a non-empty "sources" array.');

  const report = {
    generatedAt: new Date().toISOString(),
    configPath,
    outPath,
    reportPath,
    rawCount: 0,
    outputCount: 0,
    sources: [],
    accepted: [],
    rejected: [],
  };
  const acceptedByFingerprint = new Map();

  for (const source of sources) {
    try {
      const rawJobs = await loadSourceJobs(source, configPath);
      report.rawCount += rawJobs.length;
      report.sources.push({ name: source.name, type: source.type, rawJobs: rawJobs.length, ok: true });

      rawJobs.forEach(rawJob => {
        const post = normalizeSourceJob(rawJob, source);
        const rawLocationText = `${rawJob.rawLocation || ''}`.trim();
        if (Array.isArray(source.allowedLocationPatterns) && source.allowedLocationPatterns.length) {
          const isAllowedLocation = source.allowedLocationPatterns.some(pattern => {
            try {
              return new RegExp(String(pattern), 'i').test(rawLocationText);
            } catch {
              return rawLocationText.toLowerCase().includes(String(pattern).toLowerCase());
            }
          });
          if (!isAllowedLocation) {
            report.rejected.push({
              title: post.title,
              companyName: post.companyName,
              sourceName: source.name,
              reason: `Location "${rawLocationText || 'n/a'}" did not match allowed patterns.`,
              score: 0,
            });
            return;
          }
        }
        const sourceRuleError = validateSourceRules(post, source);
        const validationError = sourceRuleError || validatePost(post);
        const { score, notes } = scorePost(post, source);
        const rejectionReason = validationError || (score < options.minScore ? `Score ${score} below threshold ${options.minScore}.` : '');
        const fingerprint = buildFingerprint(post);

        if (acceptedByFingerprint.has(fingerprint)) {
          report.rejected.push({
            title: post.title,
            companyName: post.companyName,
            sourceName: source.name,
            reason: 'Duplicate fingerprint in this run.',
            score,
          });
          return;
        }

        if (rejectionReason) {
          report.rejected.push({
            title: post.title,
            companyName: post.companyName,
            sourceName: source.name,
            reason: rejectionReason,
            score,
          });
          return;
        }

        const outputPost = {
          ...post,
          sourceUrl: post._seedMeta.sourceUrl || undefined,
          seedScore: score,
          seedNotes: notes,
          seedSource: source.name,
        };
        delete outputPost._seedMeta;
        acceptedByFingerprint.set(fingerprint, outputPost);
        report.accepted.push({
          title: post.title,
          companyName: post.companyName,
          sourceName: source.name,
          score,
          category: post.category,
        });
      });
    } catch (error) {
      report.sources.push({
        name: source.name,
        type: source.type,
        ok: false,
        error: error.message,
      });
    }
  }

  const rankedPosts = Array.from(acceptedByFingerprint.values())
    .sort((left, right) => right.seedScore - left.seedScore);

  const sourceCounts = new Map();
  const sourceTitleLocationKeys = new Map();
  const outputPosts = [];
  for (const post of rankedPosts) {
    if (outputPosts.length >= options.limit) break;
    const sourceName = post.seedSource || 'unknown';
    const sourceConfig = sources.find(source => source.name === sourceName) || {};
    const explicitSourceLimit = Number(sourceConfig.maxAccepted || 0);
    const activeSourceLimit = explicitSourceLimit || options.perSourceLimit || 0;
    const currentCount = sourceCounts.get(sourceName) || 0;
    if (activeSourceLimit > 0 && currentCount >= activeSourceLimit) continue;
    if (sourceConfig.dedupeByTitleLocation) {
      const titleLocationKey = buildTitleLocationFingerprint(post);
      const seenTitleLocationKeys = sourceTitleLocationKeys.get(sourceName) || new Set();
      if (seenTitleLocationKeys.has(titleLocationKey)) continue;
      seenTitleLocationKeys.add(titleLocationKey);
      sourceTitleLocationKeys.set(sourceName, seenTitleLocationKeys);
    }
    outputPosts.push(post);
    sourceCounts.set(sourceName, currentCount + 1);
  }

  report.outputCount = outputPosts.length;

  await writeJson(outPath, outputPosts);
  await writeJson(reportPath, report);
  console.log(summarizeReport(report));
}

main().catch(error => {
  console.error(`seed:jobs failed: ${error.message}`);
  process.exit(1);
});

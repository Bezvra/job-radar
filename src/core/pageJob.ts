import { stripHtml } from './rss'

/**
 * A job read from the page open in the user's tab (the popup's «Оцінити цю вакансію»): LinkedIn, Work.ua, a company's
 * careers page… Nothing here fetches anything; the popup reads the tab only when the user clicks the extension.
 */

/** What the popup's injected script reads from the tab; plain data, so the parsing below is testable */
export interface PageSnapshot {
    url: string
    /** document.title */
    title: string
    /** Text of every <script type="application/ld+json"> */
    ldJson: string[]
    /** What the site's selectors found ('' if nothing); only known sites have them (see selectorsFor) */
    picked: { title: string; company: string; top: string; salary: string; description: string }
    /** The first <h1> */
    h1: string
    /** Text the user selected: taken as the description (when it's long enough to be one), since they know best */
    selection: string
    /** <main> (or <body>) text: the last resort */
    text: string
}

/**
 * Where a site keeps the job. Each list is tried in order, the first element with text wins. Class names are the
 * fragile part, so there are structural fallbacks too: the description is the article or section around a heading
 * matching `descriptionHeading` (or, without one, the first ancestor of the heading with real text besides it). The
 * "top card" (location, workplace type, company) is the largest block around the title that doesn't reach the
 * description. Company, salary and workplace type are then looked for in that card or, without one, in the job's pane
 * (the block just around the description): the first `cardCompany` link, the first element whose whole text is a
 * salary (`SALARY_TEXT`), and an element outside the description reading just `workplace` ("Remote"). With neither a
 * description selector nor a heading, the description is the job card itself: the first ancestor of the title that
 * holds a `cardCompany` link, widened past wrappers with the same text and then while a parent at least doubles it
 * (that first block can be just the header with the title, company and salary).
 */
export interface SiteSelectors {
    title: string[]
    company: string[]
    /** Location, workplace type, employment type: the lines above the description (every match is kept) */
    top: string[]
    salary: string[]
    description: string[]
    /** Regex source, case-insensitive */
    descriptionHeading: string
    cardCompany: string
    /** Regex source, case-insensitive, for the whole text of an element */
    workplace: string
    /** Regex source, case-insensitive, for an element whose whole text is a salary; '' to skip */
    salaryText: string
}

const NO_SELECTORS: SiteSelectors = {
    title: [],
    company: [],
    top: [],
    salary: [],
    description: [],
    descriptionHeading: '',
    cardCompany: '',
    workplace: '',
    salaryText: '',
}

/** "Від 1200$", "$400–800", "75 000 ₴": a currency somewhere, nothing but an amount or a range otherwise */
export const SALARY_TEXT =
    '^(?=.*(\\$|€|₴|грн|usd|eur|uah))(від|до|from|up to)?\\s*[$€]?\\s*\\d[\\d\\s\\u00a0\\u202f]*([–—-]\\s*[$€]?\\s*\\d[\\d\\s\\u00a0\\u202f]*)?\\s*(\\$|€|₴|грн\\.?|usd|eur|uah)?$'

/**
 * LinkedIn's job view: signed in (/jobs/view/…, and the right pane of /jobs/collections/…?currentJobId=… or search)
 * and signed out (the "topcard" classes; those pages also have JSON-LD). In the signed-in UI of 2026 the class names
 * are generated, so it's found by structure: the title is a heading linking to /jobs/view/, the description an
 * <article> headed «About the job» / «Про цю вакансію», with the location line and the On-site/Remote/Hybrid button
 * in the top card around the title. The newer search (/jobs/search-results/?currentJobId=…) has no article, and its
 * title is a plain paragraph: there the title and company come from the tab title ("Role | Company | LinkedIn", see
 * linkedinTitle) and the workplace type from a lone "Remote" link. Both checked against the live pages (Ukrainian UI)
 * through their accessibility trees.
 */
export const SITE_SELECTORS: SiteSelectors = {
    title: [
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title',
        '.top-card-layout__title',
        ...['h1', 'h2', 'h3'].map((h) => `${h} a[href*="/jobs/view/"]`),
    ],
    company: [
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name',
        '.topcard__org-name-link',
    ],
    top: [
        '.job-details-jobs-unified-top-card__primary-description-container',
        '.job-details-fit-level-preferences',
        '.jobs-unified-top-card__workplace-type',
        '.topcard__flavor-row',
    ],
    salary: [],
    description: [
        '#job-details',
        '.jobs-description__content',
        '.jobs-description-content__text',
        '.show-more-less-html__markup',
    ],
    descriptionHeading: '^(about the job|про цю вакансію|о вакансии)$',
    cardCompany: 'a[href*="/company/"]',
    workplace: '^(remote|hybrid|on-site|віддалено|гібрид\\S*|на місці|в офісі)$',
    salaryText: '',
}

/**
 * A DOU job page (jobs.dou.ua/companies/…/vacancies/…/): no JobPosting JSON-LD, but stable classes, checked in its
 * HTML: `h1.g-h2`, the company in `.b-compinfo .l-n`, the city and salary in `.sh-info`, the text in `.vacancy-section`.
 * The page also lists similar jobs on the side, which the whole page text would drag in.
 */
const DOU_SELECTORS: SiteSelectors = {
    ...NO_SELECTORS,
    title: ['h1.g-h2'],
    company: ['.b-compinfo .l-n a'],
    top: ['.sh-info .place'],
    salary: ['.sh-info .salary'],
    description: ['.b-typo.vacancy-section'],
}

/**
 * A Work.ua job page (work.ua/jobs/123/): no JobPosting JSON-LD, and behind Cloudflare, so it was read through the
 * accessibility tree only, without class names. The job card holds the salary/company/city list, «Про вакансію» with
 * the text, «Ключові вимоги і навички» and the skill tags; salary statistics and similar jobs sit next to it.
 */
const WORK_UA_SELECTORS: SiteSelectors = {
    ...NO_SELECTORS,
    title: ['h1'],
    descriptionHeading: '^(про вакансію|о вакансии)$',
    cardCompany: 'a[href*="/jobs/by-company/"]',
    salaryText: SALARY_TEXT,
}

/**
 * A Robota.ua job page (robota.ua/company…/vacancy…): an Angular app behind Cloudflare. The one <article> wraps the
 * whole page, side lists included, and the text has no heading; the job card (`lib-content` in `.vacancy-content`)
 * holds the h1, the company link (/company13611309), the city, the salary («75 000 ₴»), the tags («В офісі/на місці»)
 * and the text (`#description-wrap`). From the h1 (checked in the live DOM through a console snippet): a 102-char
 * header with the company link, a wrapper of the same length, then the 5000-char `lib-content`, then wrappers adding
 * the hot list. So the card is found from the h1 (see SiteSelectors), not by those class names.
 */
const ROBOTA_UA_SELECTORS: SiteSelectors = {
    ...NO_SELECTORS,
    title: ['h1'],
    cardCompany: 'a[href*="robota.ua/company"], a[href^="/company"]',
    salaryText: SALARY_TEXT,
}

/** Site selectors apply only on their site: a generic "/company/ link" elsewhere would be some other company */
export function selectorsFor(url: string): SiteSelectors {
    const host = new URL(url).hostname
    const on = (site: string) => host === site || host.endsWith(`.${site}`)
    if (on('linkedin.com')) return SITE_SELECTORS
    if (on('jobs.dou.ua')) return DOU_SELECTORS
    if (on('work.ua')) return WORK_UA_SELECTORS
    if (on('robota.ua')) return ROBOTA_UA_SELECTORS
    return NO_SELECTORS
}

/**
 * LinkedIn's tab title for a job: "Senior Frontend Engineer | ClickUp | LinkedIn", where the role may hold " | " too
 * ("Senior Software Engineer | Kimchi Studio | Kimchi | LinkedIn"); "(1) " in front counts notifications. A list page
 * ("Вибір найкращих для вас вакансій | LinkedIn") has only two parts and gives nothing.
 */
export function linkedinTitle(title: string): { title: string; company: string } | null {
    const parts = title.replace(/^\(\d+\)\s*/, '').split(' | ')
    if (parts.length < 3 || parts.at(-1) !== 'LinkedIn') return null
    return { title: parts.slice(0, -2).join(' | '), company: parts.at(-2)! }
}

export interface PageJob {
    id: string
    url: string
    title: string
    company: string
    description: string
    publishedAt: string | null
    /** No description found: scored on the whole page text, which may hold other jobs, menus… */
    guessed: boolean
}

const MAX_DESCRIPTION = 8000
/** A shorter selection is likely a stray click-and-drag, not the description */
export const MIN_SELECTION = 100

/** The job's own address: LinkedIn's search pane shows a job as ?currentJobId=…, otherwise the URL without query */
export function pageJobUrl(raw: string): string {
    const url = new URL(raw)
    url.hash = ''
    const host = url.hostname.replace(/^www\./, '')
    const linkedinId = host.endsWith('linkedin.com')
        ? url.searchParams.get('currentJobId') ?? url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d+)/)?.[1]
        : null
    if (linkedinId) return `https://www.linkedin.com/jobs/view/${linkedinId}`
    url.search = ''
    return url.toString().replace(/\/$/, '')
}

interface Posting {
    title?: string
    company?: string
    description?: string
    datePosted?: string
    remote?: boolean
    salary?: string
}

/** schema.org JobPosting, also inside @graph or an array */
function readPosting(blocks: string[]): Posting | null {
    for (const block of blocks) {
        let data: unknown
        try {
            data = JSON.parse(block)
        } catch {
            continue // malformed block, try the next one
        }
        const items = [data].flat().flatMap((d: any) => [d, ...(d?.['@graph'] ?? [])])
        const p: any = items.find((d: any) => [d?.['@type']].flat().includes('JobPosting'))
        if (!p) continue
        const org = [p.hiringOrganization].flat()[0]
        return {
            title: typeof p.title === 'string' ? p.title.trim() : undefined,
            company: typeof org === 'string' ? org : org?.name?.trim(),
            description: typeof p.description === 'string' ? stripHtml(p.description) : undefined,
            datePosted: p.datePosted,
            remote: [p.jobLocationType].flat().includes('TELECOMMUTE'),
            salary: salaryLine(p.baseSalary),
        }
    }
    return null
}

/** baseSalary as a line findSalary trusts at the start of a description: "3000–4500 USD", "25–35 USD/hour" */
function salaryLine(s: any): string | undefined {
    const value = s?.value
    const currency = s?.currency ?? value?.currency
    const min = value?.minValue ?? value?.value
    const max = value?.maxValue ?? value?.value
    if (!currency || !(min || max)) return undefined
    const period = { HOUR: '/hour', YEAR: '/year' }[String(value?.unitText).toUpperCase()] ?? ''
    return `${min && max && min !== max ? `${min}–${max}` : min ?? max} ${currency}${period}`
}

export function jobFromPage(page: PageSnapshot): PageJob | null {
    let url: string
    try {
        url = pageJobUrl(page.url)
    } catch {
        return null
    }
    const posting = readPosting(page.ldJson)
    const tab = new URL(url).hostname.endsWith('linkedin.com') ? linkedinTitle(page.title) : null
    const title = page.picked.title || posting?.title || tab?.title || page.h1 || page.title
    const selection = page.selection.trim().length >= MIN_SELECTION ? page.selection : ''
    const body = selection || page.picked.description || posting?.description || ''
    const lines = [
        // First, where findSalary trusts a bare amount
        page.picked.salary || posting?.salary,
        page.picked.top,
        // The flag alone, so the remote rule sees it; LinkedIn's top card already says "Remote"
        !page.picked.top && posting?.remote ? 'Remote' : '',
        body || page.text,
    ]
    const description = lines
        .filter(Boolean)
        .join('\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, MAX_DESCRIPTION)
    if (!title.trim() || !description) return null
    const date = posting?.datePosted ? new Date(posting.datePosted) : null
    return {
        id: url,
        url,
        title: title.replace(/\s+/g, ' ').trim(),
        company: (page.picked.company || posting?.company || tab?.company || '').replace(/\s+/g, ' ').trim(),
        description,
        publishedAt: date && !isNaN(date.getTime()) ? date.toISOString() : null,
        guessed: !body,
    }
}

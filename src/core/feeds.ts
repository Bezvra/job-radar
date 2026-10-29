import { t } from '../i18n'
import type { Direction } from './profile'
import type { Source } from './types'

/**
 * Feeds are the sites' own search pages as RSS: the same query string works on both, so a search set up on the site
 * can be pasted and converted. Djinni filters by its own category keys (`primary_keyword`), case-sensitive; an unknown
 * value is silently ignored and the feed returns the latest 100 jobs from every category. DOU filters by `category`.
 */

export const DJINNI_HOST = 'djinni.co'
export const DOU_HOST = 'jobs.dou.ua'

/** Djinni `primary_keyword` values from the category tree on djinni.co/jobs/ (development, QA, data, ops) */
export const DJINNI_KEYWORDS = [
    'JavaScript',
    'Angular',
    'Markup',
    'React.js',
    'Svelte',
    'Vue.js',
    'Fullstack',
    'Java',
    '.NET',
    'ASP.NET',
    'Blazor',
    'Python',
    'PHP',
    'Drupal',
    'Laravel',
    'Magento',
    'Symfony',
    'WordPress',
    'Yii',
    'Node.js',
    'iOS',
    'Android',
    'React Native',
    'C++',
    'C Lang',
    'CPP',
    'Embedded',
    'Flutter',
    'Golang',
    'Ruby',
    'Scala',
    'Salesforce',
    'Rust',
    'Elixir',
    'Kotlin',
    'QA',
    'QA Automation',
    'Data Science',
    'ML AI',
    'Data Analyst',
    'Data Engineer',
    'SQL',
    'DevOps',
    'Security',
    'Sysadmin',
    'Lead',
    'Architect',
    'Unity',
]

/** DOU `category` values from the select on jobs.dou.ua/vacancies/ (the technical ones) */
export const DOU_CATEGORIES = [
    '.NET',
    'AI/ML',
    'Android',
    'Big Data',
    'Blockchain',
    'C++',
    'Data Engineer',
    'Data Science',
    'DBA',
    'DevOps',
    'Embedded',
    'Erlang',
    'Flutter',
    'Front End',
    'Golang',
    'iOS/macOS',
    'Java',
    'Node.js',
    'PHP',
    'Python',
    'QA',
    'React Native',
    'Ruby',
    'Rust',
    'Scala',
    'Security',
    'SysAdmin',
    'Unity',
]

/** Tech id → the site's own category; DOU has no category for frontend frameworks, so those get a text search there */
const TECH_FEEDS: Record<string, { djinni?: string; dou?: string; douSearch?: string }> = {
    react: { djinni: 'React.js', douSearch: 'React' },
    angular: { djinni: 'Angular', douSearch: 'Angular' },
    vue: { djinni: 'Vue.js', douSearch: 'Vue' },
    svelte: { djinni: 'Svelte', douSearch: 'Svelte' },
    javascript: { djinni: 'JavaScript', dou: 'Front End' },
    typescript: { djinni: 'JavaScript', dou: 'Front End' },
    nodejs: { djinni: 'Node.js', dou: 'Node.js' },
    nestjs: { djinni: 'Node.js', dou: 'Node.js' },
    dotnet: { djinni: '.NET', dou: '.NET' },
    csharp: { djinni: '.NET', dou: '.NET' },
    java: { djinni: 'Java', dou: 'Java' },
    spring: { djinni: 'Java', dou: 'Java' },
    kotlin: { djinni: 'Kotlin', douSearch: 'Kotlin' },
    python: { djinni: 'Python', dou: 'Python' },
    django: { djinni: 'Python', dou: 'Python' },
    fastapi: { djinni: 'Python', dou: 'Python' },
    go: { djinni: 'Golang', dou: 'Golang' },
    php: { djinni: 'PHP', dou: 'PHP' },
    laravel: { djinni: 'Laravel', dou: 'PHP' },
    symfony: { djinni: 'Symfony', dou: 'PHP' },
    wordpress: { djinni: 'WordPress', dou: 'PHP' },
    ruby: { djinni: 'Ruby', dou: 'Ruby' },
    rust: { djinni: 'Rust', dou: 'Rust' },
    scala: { djinni: 'Scala', dou: 'Scala' },
    elixir: { djinni: 'Elixir', dou: 'Erlang' },
    cpp: { djinni: 'C++', dou: 'C++' },
    reactnative: { djinni: 'React Native', dou: 'React Native' },
    flutter: { djinni: 'Flutter', dou: 'Flutter' },
    swift: { djinni: 'iOS', dou: 'iOS/macOS' },
    android: { djinni: 'Android', dou: 'Android' },
    ml: { djinni: 'ML AI', dou: 'AI/ML' },
    llm: { djinni: 'ML AI', dou: 'AI/ML' },
    spark: { djinni: 'Data Engineer', dou: 'Data Engineer' },
    docker: { djinni: 'DevOps', dou: 'DevOps' },
    kubernetes: { djinni: 'DevOps', dou: 'DevOps' },
    terraform: { djinni: 'DevOps', dou: 'DevOps' },
    playwright: { djinni: 'QA Automation', dou: 'QA' },
    cypress: { djinni: 'QA Automation', dou: 'QA' },
    selenium: { djinni: 'QA Automation', dou: 'QA' },
}

/** Fallback when no stack tech maps to a category */
const DIRECTION_FEEDS: Record<Direction, { djinni?: string; dou?: string }> = {
    frontend: { djinni: 'JavaScript', dou: 'Front End' },
    backend: {},
    mobile: {},
}

export const djinniFeed = (keyword: string) =>
    `https://${DJINNI_HOST}/jobs/rss/?primary_keyword=${encodeURIComponent(keyword)}`
export const douFeed = (params: { category?: string; search?: string }) =>
    `https://${DOU_HOST}/vacancies/feeds/?${new URLSearchParams(params as Record<string, string>)}`.replace(
        /\+/g,
        '%20',
    )

/** A Djinni or DOU search page (or a feed already) → its RSS feed URL; null if it's neither site's job search */
export function toFeedUrl(input: string): string | null {
    let url: URL
    try {
        url = new URL(input.trim())
    } catch {
        return null
    }
    url.protocol = 'https:'
    url.hash = ''
    url.searchParams.delete('page')
    const host = url.hostname.replace(/^www\./, '')
    if (host === DJINNI_HOST && /^\/jobs(\/rss)?\/?$/.test(url.pathname)) url.pathname = '/jobs/rss/'
    else if (host === DOU_HOST && /^\/vacancies(\/feeds)?\/?$/.test(url.pathname)) url.pathname = '/vacancies/feeds/'
    else return null
    url.hostname = host
    return url.toString().replace(/\+/g, '%20')
}

/** A readable name from the filters: "Djinni · React.js, Vue.js", "DOU · Front End", "DOU · пошук «React»" */
export function feedName(feedUrl: string): string {
    const url = new URL(feedUrl)
    const p = url.searchParams
    const site = url.hostname === DJINNI_HOST ? 'Djinni' : 'DOU'
    const parts = [
        ...p.getAll('primary_keyword'),
        ...p.getAll('category'),
        ...[...p.getAll('all_keywords'), ...p.getAll('keywords'), ...p.getAll('search')]
            .filter(Boolean)
            .map(t.feeds.search),
    ]
    const known = new Set(['primary_keyword', 'category', 'all_keywords', 'keywords', 'search'])
    const more = [...p.keys()].some((k) => !known.has(k)) ? t.feeds.more : ''
    return `${site} · ${parts.join(', ') || t.feeds.all}${more}`
}

/**
 * Djinni keys the site doesn't know (wrong case, a made-up category): the feed would ignore them and return everything.
 * Not an error, since Djinni may add categories; callers show it as a warning.
 */
export function unknownDjinniKeywords(feedUrl: string): string[] {
    const url = new URL(feedUrl)
    if (url.hostname !== DJINNI_HOST) return []
    return url.searchParams.getAll('primary_keyword').filter((k) => !DJINNI_KEYWORDS.includes(k))
}

export interface FeedSuggestion {
    name: string
    url: string
    /** Preselected: the feed comes from one of the top stack techs */
    checked: boolean
}

/**
 * Feeds for a stack: the techs' Djinni categories and DOU categories (or a DOU search for frameworks DOU has no category
 * for), in the order of the techs' weights. The first two feeds per site are preselected; the rest are offered unticked.
 */
export function suggestFeeds(techIds: string[], direction: Direction): FeedSuggestion[] {
    const djinni: string[] = []
    const dou: { category?: string; search?: string }[] = []
    const add = <T>(list: T[], item: T) =>
        !list.some((x) => JSON.stringify(x) === JSON.stringify(item)) && list.push(item)
    for (const id of techIds) {
        const f = TECH_FEEDS[id]
        if (!f) continue
        if (f.djinni) add(djinni, f.djinni)
        if (f.dou) add(dou, { category: f.dou })
        if (f.douSearch) add(dou, { search: f.douSearch })
    }
    const fallback = DIRECTION_FEEDS[direction]
    if (fallback.djinni) add(djinni, fallback.djinni)
    if (fallback.dou) add(dou, { category: fallback.dou })
    const urls = [
        ...djinni.slice(0, 5).map((k, i) => ({ url: djinniFeed(k), checked: i < 2 })),
        ...dou.slice(0, 5).map((d, i) => ({ url: douFeed(d), checked: i < 2 })),
    ]
    return urls.map((s) => ({ ...s, name: feedName(s.url) }))
}

/** Djinni RSS has no company, so its job pages are read (see background.ts checkJobPages) */
export const needsPages = (feedUrl: string) => new URL(feedUrl).hostname === DJINNI_HOST

/** Sources for the chosen feeds, named as on the wizard step; one that's already a source keeps its id (Job.sourceIds refers to it) */
export function toSources(feeds: { name: string; url: string }[], existing: Source[]): Source[] {
    return feeds.map((f, i) => {
        const old = existing.find((s) => s.url === f.url)
        return old
            ? { ...old, name: f.name, enabled: true }
            : {
                  id: `src-${Date.now().toString(36)}-${i}`,
                  name: f.name,
                  url: f.url,
                  enabled: true,
                  ...(needsPages(f.url) && { fetchPages: true }),
              }
    })
}

import type { Salary } from './salary'

export interface Source {
    id: string
    name: string
    /** RSS feed URL */
    url: string
    enabled: boolean
    /** Open job pages from this feed to read details the RSS lacks (see core/jobPage.ts; for now the company) */
    fetchPages?: boolean
}

export interface Rule {
    /** Regex source, matched case-insensitively against title + description */
    pattern: string
    weight: number
    label: string
    /** Match only in title (stronger signal for seniority/role) */
    titleOnly?: boolean
    /** Regex: the rule doesn't apply if this matches anywhere in title + description */
    unless?: string
    /**
     * A generated rule's label as a message key (i18n `t.rule`), so it shows in the current language; `label` is the
     * text at creation. Dropped when the user renames the rule
     */
    labelKey?: { id: string; args?: string[] }
}

export interface Settings {
    sources: Source[]
    rules: Rule[]
    /** Score at or above which a job is shown as "Подавайся" */
    applyThreshold: number
    /** Score below which a job is hidden from the report by default */
    hideBelow: number
    /** Jobs published more than this many days ago are treated as stale: not offered to apply, not notified */
    maxAgeDays: number
    /** Weights (≤ 0) for dictionary techs a job mentions that no rule covers: per tech in the title, per stack tech in the description */
    unlistedTech: { title: number; description: number }
    /** Most points all matching tech rules together can add, so level, role and format still decide */
    techBonusCap: number
    /** Lowest acceptable salary in $/month; jobs that pay less go to «Сховані». 0: off */
    minSalary: number
    /** Refresh interval in hours */
    intervalHours: number
    notify: boolean
    telegram: { enabled: boolean; botToken: string; chatId: string }
    /** Interface language; 'auto' follows the browser (see i18n resolveLocale) */
    locale: 'auto' | 'uk' | 'en'
}

export type JobStatus = 'new' | 'seen' | 'saved' | 'applied' | 'hidden'

export interface Job {
    id: string
    title: string
    company: string
    url: string
    description: string
    publishedAt: string | null
    sourceIds: string[]
    /** URLs of the same job on other sites (a DOU copy of a Djinni job), found by dedup */
    alternates?: string[]
    firstSeen: string
    score: number
    reasons: { label: string; weight: number }[]
    /** Techs mentioned without affecting the score (see ScoreResult.neutral); missing on jobs scored before it existed */
    neutral?: string[]
    status: JobStatus
    /** Parsed from the title or description (core/salary.ts); null: none stated */
    salary?: Salary | null
    /** The job page was already fetched to fill in missing details (Djinni RSS has no company) */
    pageChecked?: boolean
}

export interface RawItem {
    title: string
    link: string
    description: string
    pubDate: string | null
    author: string | null
    categories: string[]
}

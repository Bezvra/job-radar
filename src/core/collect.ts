import type { PageJob } from './pageJob'
import type { Job, JobStatus, Settings, Source } from './types'
import { parseRss } from './rss'
import { normalize, dedupeKey } from './normalize'
import { belowMinSalary, findSalary } from './salary'
import { scoreJob } from './scoring'

/** How long jobs are kept in storage; also the upper bound for `Settings.maxAgeDays` */
export const MAX_AGE_DAYS = 45

const hostOf = (url: string) => {
    try {
        return new URL(url).hostname
    } catch {
        return ''
    }
}

/** Remember `url` as another site's copy of `job`; a second posting on the same site isn't a copy */
function addAlternate(job: Job, url: string) {
    if (url === job.url || hostOf(url) === hostOf(job.url) || job.alternates?.includes(url)) return
    job.alternates = [...(job.alternates ?? []), url]
}

/** Published (or, without a feed date, first seen) within the last `maxAgeDays` days. */
export function isFresh(job: Job, maxAgeDays: number, now = new Date()): boolean {
    const at = new Date(job.publishedAt ?? job.firstSeen).getTime()
    return now.getTime() - at <= maxAgeDays * 86_400_000
}

/** Not filtered out by age or pay: published recently and not paying less than the user's minimum */
export const isOpenToApply = (job: Job, settings: Settings, now = new Date()) =>
    isFresh(job, settings.maxAgeDays, now) && !belowMinSalary(job.salary, settings.minSalary)

/** Worth applying to: fresh, paying enough (or not saying) and scoring at or above the apply threshold. */
export const isRelevant = (job: Job, settings: Settings, now = new Date()) =>
    job.score >= settings.applyThreshold && isOpenToApply(job, settings, now)

/** Pure merge step: feeds' items + existing store → updated store. Testable without chrome APIs. */
export function mergeFeed(
    jobs: Record<string, Job>,
    xml: string,
    sourceId: string,
    settings: Settings,
    now = new Date(),
): { added: Job[]; count: number } {
    const items = parseRss(xml).map(normalize)
    const byKey = new Map(Object.values(jobs).map((j) => [dedupeKey(j.title, j.company), j]))
    const added: Job[] = []

    for (const it of items) {
        const existing = jobs[it.id] ?? (it.company ? byKey.get(dedupeKey(it.title, it.company)) : undefined)
        if (existing) {
            if (!existing.sourceIds.includes(sourceId)) existing.sourceIds.push(sourceId)
            addAlternate(existing, it.url)
            continue
        }
        const { score, reasons, neutral } = scoreJob(it.title, it.description, settings.rules, settings)
        const job: Job = {
            ...it,
            sourceIds: [sourceId],
            firstSeen: now.toISOString(),
            score,
            reasons,
            neutral,
            status: 'new',
            salary: findSalary(it.title, it.description),
        }
        jobs[job.id] = job
        byKey.set(dedupeKey(job.title, job.company), job)
        added.push(job)
    }
    return { added, count: items.length }
}

/** A job from the page open in the user's tab, scored like a feed's; it has no source, so only saved/applied ones stay */
export function pageToJob(page: PageJob, settings: Settings, status: JobStatus, now = new Date()): Job {
    const { guessed, ...job } = page
    const { score, reasons, neutral } = scoreJob(job.title, job.description, settings.rules, settings)
    return {
        ...job,
        sourceIds: [],
        firstSeen: now.toISOString(),
        score,
        reasons,
        neutral,
        status,
        salary: findSalary(job.title, job.description),
    }
}

/** Put a job from the user's tab into the store: a new one as is, a known one (same URL) just takes the status */
export function addPageJob(jobs: Record<string, Job>, job: Job): Job {
    const known = jobs[job.id]
    if (known) known.status = job.status
    else jobs[job.id] = job
    return jobs[job.id]
}

const STATUS_RANK: Record<Job['status'], number> = { new: 0, seen: 1, hidden: 2, saved: 3, applied: 4 }

/**
 * Merge copies of one job from different sites that only now share a dedupe key: a Djinni job gets its company from
 * its page after the merge, so its DOU copy was stored separately. The first seen copy stays and takes the others'
 * sources, URLs and the furthest status (applied over saved over hidden…). Returns the ids that were merged away.
 */
export function mergeDuplicates(jobs: Record<string, Job>): string[] {
    const byKey = new Map<string, Job>()
    const removed: string[] = []
    const oldestFirst = Object.values(jobs).sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))
    for (const job of oldestFirst) {
        if (!job.company) continue
        const key = dedupeKey(job.title, job.company)
        const kept = byKey.get(key)
        if (!kept) {
            byKey.set(key, job)
            continue
        }
        if ([kept.url, ...(kept.alternates ?? [])].some((url) => hostOf(url) === hostOf(job.url))) continue
        for (const id of job.sourceIds) if (!kept.sourceIds.includes(id)) kept.sourceIds.push(id)
        for (const url of [job.url, ...(job.alternates ?? [])]) addAlternate(kept, url)
        if (STATUS_RANK[job.status] > STATUS_RANK[kept.status]) kept.status = job.status
        delete jobs[job.id]
        removed.push(job.id)
    }
    return removed
}

/** A fresh job without a company, from a source that allows opening job pages, not checked yet. */
export function needsPageCheck(job: Job, settings: Settings, now = new Date()): boolean {
    const allowed = job.sourceIds.some((id) => settings.sources.find((s) => s.id === id)?.fetchPages)
    return allowed && !job.company && !job.pageChecked && isFresh(job, settings.maxAgeDays, now)
}

/** Re-score everything after rules change (and re-read salaries, for jobs stored before parsing existed); keeps user statuses. */
export function rescoreAll(jobs: Record<string, Job>, settings: Settings): void {
    for (const j of Object.values(jobs)) {
        const { score, reasons, neutral } = scoreJob(j.title, j.description, settings.rules, settings)
        j.score = score
        j.reasons = reasons
        j.neutral = neutral
        j.salary = findSalary(j.title, j.description)
    }
}

/** A fresh start after the wizard: only the jobs the user saved or applied to stay */
export function resetJobs(jobs: Record<string, Job>): void {
    for (const [id, j] of Object.entries(jobs)) if (j.status !== 'saved' && j.status !== 'applied') delete jobs[id]
}

/** Drop old jobs and jobs from removed sources, but never ones the user saved or applied to. */
export function prune(jobs: Record<string, Job>, sources: Source[], now = new Date()): void {
    const cutoff = now.getTime() - MAX_AGE_DAYS * 86_400_000
    const ids = new Set(sources.map((s) => s.id))
    for (const [id, j] of Object.entries(jobs)) {
        if (j.status === 'saved' || j.status === 'applied') continue
        if (new Date(j.firstSeen).getTime() < cutoff) delete jobs[id]
        // Every source it came from was removed (another stack in the wizard, a feed deleted in settings); a disabled
        // source still counts, since that's a pause
        else if (!j.sourceIds.some((s) => ids.has(s))) delete jobs[id]
    }
}

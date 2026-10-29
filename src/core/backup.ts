import { DEFAULT_SETTINGS } from './defaults'
import type { Job, Settings } from './types'

/**
 * A backup file: the settings (rules, sources, Telegram token…) and the jobs worth keeping, saved and applied ones.
 * The rest come back with the next refresh
 */
export interface Backup {
    format: typeof BACKUP_FORMAT
    /** The extension version that made it; rules from an older one are upgraded on import (upgradeRules) */
    version: string
    exportedAt: string
    settings: Settings
    jobs: Job[]
}

export const BACKUP_FORMAT = 'it-job-radar-backup'

const KEPT: Job['status'][] = ['saved', 'applied']

export const makeBackup = (
    settings: Settings,
    jobs: Record<string, Job>,
    version: string,
    now = new Date(),
): Backup => ({
    format: BACKUP_FORMAT,
    version,
    exportedAt: now.toISOString(),
    settings,
    jobs: Object.values(jobs).filter((j) => KEPT.includes(j.status)),
})

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const isJob = (j: unknown): j is Job =>
    isObject(j) &&
    typeof j.id === 'string' &&
    typeof j.title === 'string' &&
    typeof j.url === 'string' &&
    KEPT.includes(j.status as Job['status'])

/** The settings and jobs from a backup file's text, or null if it isn't one. Settings missing a newer field get its default */
export function readBackup(text: string, now = new Date()): { settings: Settings; jobs: Job[] } | null {
    let data: unknown
    try {
        data = JSON.parse(text)
    } catch {
        return null
    }
    if (!isObject(data) || data.format !== BACKUP_FORMAT || !isObject(data.settings)) return null
    const settings = { ...DEFAULT_SETTINGS, ...data.settings } as Settings
    if (!Array.isArray(settings.sources) || !Array.isArray(settings.rules)) return null
    const jobs = Array.isArray(data.jobs) ? data.jobs.filter(isJob) : []
    // Stored jobs have these; a hand-edited file may not, and scoring needs them
    const filled = jobs.map((j) => ({
        ...j,
        company: j.company ?? '',
        description: j.description ?? '',
        publishedAt: j.publishedAt ?? null,
        firstSeen: j.firstSeen ?? now.toISOString(),
        sourceIds: j.sourceIds ?? [],
        score: j.score ?? 0,
        reasons: j.reasons ?? [],
    }))
    return { settings, jobs: filled }
}

/** Adds the backup's jobs; one already stored takes the backup's status unless it got further (applied over saved) */
export function importJobs(jobs: Record<string, Job>, imported: Job[]): number {
    for (const job of imported) {
        const known = jobs[job.id]
        if (!known) jobs[job.id] = job
        else if (known.status !== 'applied') known.status = job.status
    }
    return imported.length
}

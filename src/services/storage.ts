import type { Job, Settings } from '../core/types'
import { DEFAULT_SETTINGS } from '../core/defaults'

export interface RunLog {
    at: string
    results: { sourceId: string; name: string; ok: boolean; count: number; error?: string }[]
    newRelevant: number
}

export async function getSettings(): Promise<Settings> {
    const { settings } = await chrome.storage.local.get('settings')
    return { ...DEFAULT_SETTINGS, ...((settings as Partial<Settings>) ?? {}) }
}

export async function saveSettings(s: Settings): Promise<void> {
    await chrome.storage.local.set({ settings: s })
}

export async function getJobs(): Promise<Record<string, Job>> {
    const { jobs } = await chrome.storage.local.get('jobs')
    return (jobs as Record<string, Job>) ?? {}
}

export async function saveJobs(jobs: Record<string, Job>): Promise<void> {
    await chrome.storage.local.set({ jobs })
}

export async function getLastRun(): Promise<RunLog | null> {
    const { lastRun } = await chrome.storage.local.get('lastRun')
    return (lastRun as RunLog) ?? null
}

/** A run with a failed source is also kept as `lastFailedRun`, so the next good run doesn't wipe it from diagnostics */
export async function saveLastRun(r: RunLog): Promise<void> {
    const failed = r.results.some((x) => !x.ok)
    await chrome.storage.local.set<{ lastRun: RunLog; lastFailedRun?: RunLog }>(
        failed ? { lastRun: r, lastFailedRun: r } : { lastRun: r },
    )
}

export async function getLastFailedRun(): Promise<RunLog | null> {
    const { lastFailedRun } = await chrome.storage.local.get('lastFailedRun')
    return (lastFailedRun as RunLog) ?? null
}

/** Scheduled refreshes are off while paused (the user's «Пауза»); a refresh asked for by hand still runs */
export async function getPaused(): Promise<boolean> {
    const { paused } = await chrome.storage.local.get('paused')
    return paused === true
}

export async function savePaused(paused: boolean): Promise<void> {
    await chrome.storage.local.set({ paused })
}

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

export async function saveLastRun(r: RunLog): Promise<void> {
    await chrome.storage.local.set({ lastRun: r })
}

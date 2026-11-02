import { diagnostics } from '../core/diagnostics'
import { issueUrl } from '../core/feedback'
import { getJobs, getLastRun, getPaused, getSettings } from '../services/storage'

/** The diagnostics report (core/diagnostics.ts) from what's stored now */
export async function collectDiagnostics(): Promise<string> {
    const [settings, jobs, lastRun, alarm, paused] = await Promise.all([
        getSettings(),
        getJobs(),
        getLastRun(),
        chrome.alarms.get('job-radar-refresh'),
        getPaused(),
    ])
    return diagnostics({
        version: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
        browserLanguage: navigator.language,
        settings,
        jobs,
        lastRun,
        alarm: alarm ?? null,
        paused,
    })
}

/** A new GitHub issue in a tab; a bug report comes with the diagnostics filled in */
export async function openIssue(kind: 'bug' | 'idea'): Promise<void> {
    const url = issueUrl(kind, kind === 'bug' ? await collectDiagnostics() : undefined)
    await chrome.tabs.create({ url })
}

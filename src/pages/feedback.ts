import { diagnostics } from '../core/diagnostics'
import { issueUrl } from '../core/feedback'
import { getJobs, getLastRun, getSettings } from '../services/storage'

/** The diagnostics report (core/diagnostics.ts) from what's stored now */
export async function collectDiagnostics(): Promise<string> {
    const [settings, jobs, lastRun, alarm] = await Promise.all([
        getSettings(),
        getJobs(),
        getLastRun(),
        chrome.alarms.get('job-radar-refresh'),
    ])
    return diagnostics({
        version: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
        browserLanguage: navigator.language,
        settings,
        jobs,
        lastRun,
        alarm: alarm ?? null,
    })
}

/** A new GitHub issue in a tab; a bug report comes with the diagnostics filled in */
export async function openIssue(kind: 'bug' | 'idea'): Promise<void> {
    const url = issueUrl(kind, kind === 'bug' ? await collectDiagnostics() : undefined)
    await chrome.tabs.create({ url })
}

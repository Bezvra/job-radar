import type { Job, Settings } from './types'

interface Run {
    at: string
    results: { name: string; ok: boolean; count: number; error?: string }[]
    newRelevant: number
}

export interface DiagnosticsInput {
    version: string
    userAgent: string
    browserLanguage: string
    settings: Settings
    jobs: Record<string, Job>
    lastRun: Run | null
    /** The latest run with a failed source; shown when it isn't the last run */
    lastFailedRun?: Run | null
    alarm: { scheduledTime: number; periodInMinutes?: number } | null
    paused?: boolean
    now?: Date
}

/**
 * A plain-text report for a bug report, in English for whoever reads it. It has what the extension does (version,
 * sources, schedule, the last run and its errors, job counts) and nothing personal: no Telegram token or chat id, no
 * rules (they come from the CV), no jobs' contents
 */
export function diagnostics(d: DiagnosticsInput): string {
    const s = d.settings
    const now = d.now ?? new Date()
    const minutes = (ms: number) => `${Math.round(ms / 60_000)} min`
    const ago = (at: string) => `${minutes(now.getTime() - Date.parse(at))} ago`
    const results = (run: Run) =>
        run.results.map((r) => `  ${r.ok ? 'ok ' : 'ERR'} ${r.name}: ${r.count}${r.error ? ` (${r.error})` : ''}`)
    const failed = d.lastFailedRun && d.lastFailedRun.at !== d.lastRun?.at ? d.lastFailedRun : null
    const byStatus: Record<string, number> = {}
    for (const j of Object.values(d.jobs)) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1

    const lines = [
        `IT Job Radar ${d.version}`,
        `Browser: ${d.userAgent}`,
        `Language: ${s.locale} (browser ${d.browserLanguage})`,
        `Generated: ${now.toISOString()}`,
        '',
        `Refresh: every ${s.intervalHours} h${d.paused ? ', PAUSED' : ''}; next ${
            d.alarm
                ? `${new Date(d.alarm.scheduledTime).toISOString()} (in ${minutes(d.alarm.scheduledTime - now.getTime())}, period ${d.alarm.periodInMinutes} min)`
                : 'not scheduled'
        }`,
        `Thresholds: apply ${s.applyThreshold}, hide below ${s.hideBelow}, max age ${s.maxAgeDays} d, min salary ${s.minSalary || 'off'}`,
        `Scoring: ${s.rules.length} rules, tech cap ${s.techBonusCap}, unlisted ${s.unlistedTech.title}/${s.unlistedTech.description}`,
        `Notifications: ${s.notify ? 'on' : 'off'}; Telegram: ${
            s.telegram.enabled ? 'on' : 'off'
        }, token ${s.telegram.botToken ? 'set' : 'empty'}, chat ${s.telegram.chatId ? 'set' : 'empty'}`,
        '',
        `Sources (${s.sources.filter((x) => x.enabled).length} enabled of ${s.sources.length}):`,
        ...s.sources.map((x) => `  ${x.enabled ? '+' : '-'} ${x.name}: ${x.url}${x.fetchPages ? ' [pages]' : ''}`),
        '',
        d.lastRun
            ? `Last run: ${d.lastRun.at} (${ago(d.lastRun.at)}), ${d.lastRun.newRelevant} new relevant`
            : 'Last run: never',
        ...(d.lastRun ? results(d.lastRun) : []),
        ...(failed ? [`Last failed run: ${failed.at} (${ago(failed.at)})`, ...results(failed)] : []),
        '',
        `Jobs: ${Object.keys(d.jobs).length} (${
            Object.entries(byStatus)
                .map(([k, v]) => `${k} ${v}`)
                .join(', ') || 'none'
        })`,
    ]
    return lines.join('\n')
}

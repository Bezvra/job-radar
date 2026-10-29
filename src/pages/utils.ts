import type { Job, Settings } from '../core/types'
import { locale, resolveLocale, setLocale, t } from '../i18n'

/** The interface language from the settings; pages call it while rendering, before using `t` */
export function applyLocale(settings: Pick<Settings, 'locale'>): void {
    const next = resolveLocale(settings.locale, navigator.language)
    if (next !== locale) setLocale(next)
    document.documentElement.lang = next
}

export function ago(iso: string | null): string {
    if (!iso) return ''
    const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000)
    if (h < 1) return t.ago.now
    if (h < 24) return t.ago.hours(h)
    return t.ago.days(Math.round(h / 24))
}

export function sourceNames(j: Job, settings: Settings): string {
    return j.sourceIds
        .map((id) => settings.sources.find((s) => s.id === id)?.name.split(' · ')[0] ?? id)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ')
}

export const PLATFORMS = [
    { id: 'djinni', label: 'Djinni', host: 'djinni.co' },
    { id: 'dou', label: 'DOU', host: 'jobs.dou.ua' },
] as const
export type Platform = (typeof PLATFORMS)[number]['id']

const hostOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

/** Sites the job was found on: its own URL, its copies on other sites, and its sources' feed hosts */
export function platformsOf(j: Job, settings: Settings): Platform[] {
    const hosts = new Set([
        ...[j.url, ...(j.alternates ?? [])].map(hostOf),
        ...j.sourceIds.map((id) => hostOf(settings.sources.find((s) => s.id === id)?.url ?? '')),
    ])
    return PLATFORMS.filter((p) => hosts.has(p.host)).map((p) => p.id)
}

/** Sites jobs are saved from by hand (the popup), named for the job's meta line */
const SITE_LABELS: Record<string, string> = {
    'linkedin.com': 'LinkedIn',
    'work.ua': 'Work.ua',
    'robota.ua': 'Robota.ua',
}

/** "Djinni" for a djinni.co link, "LinkedIn" for linkedin.com; other hosts as they are */
export const platformLabel = (url: string) => {
    const host = hostOf(url)
    return PLATFORMS.find((p) => p.host === host)?.label ?? SITE_LABELS[host] ?? host
}

export const formatWeight = (w: number) => `${w >= 0 ? '+' : ''}${w}`

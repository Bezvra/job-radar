import { render } from 'preact'
import { REPO_URL } from '../core/feedback'
import { openIssue } from './feedback'
import { useState } from 'preact/hooks'
import { isOpenToApply } from '../core/collect'
import type { Job, JobStatus, Settings } from '../core/types'
import { getJobs, getLastRun, getSettings } from '../services/storage'
import { JobCard } from './components/JobCard'
import { RunStatus } from './components/RunStatus'
import { useStorage } from './hooks/useStorage'
import { t } from '../i18n'
import { applyLocale, PLATFORMS, type Platform, platformsOf } from './utils'

type Tab = 'apply' | 'maybe' | 'saved' | 'applied' | 'hidden'

const TABS: Tab[] = ['apply', 'maybe', 'saved', 'applied', 'hidden']

// Saved/applied jobs stay in their tabs regardless of score, age or pay; the rest are hidden when low-scoring, stale or underpaid
function inTab(j: Job, t: Tab, settings: Settings): boolean {
    const open = j.status === 'new' || j.status === 'seen'
    const visible = open && j.score >= settings.hideBelow && isOpenToApply(j, settings)
    switch (t) {
        case 'saved':
            return j.status === 'saved'
        case 'applied':
            return j.status === 'applied'
        case 'hidden':
            return j.status === 'hidden' || (open && !visible)
        case 'apply':
            return visible && j.score >= settings.applyThreshold
        case 'maybe':
            return visible && j.score < settings.applyThreshold
    }
}

const PLATFORM_KEY = 'report.platform'
// A per-viewer convenience: storage can be unavailable, and then the filter simply starts at «Усі» (all)
const loadPlatform = (): Platform | 'all' => {
    try {
        const saved = localStorage.getItem(PLATFORM_KEY)
        return PLATFORMS.some((p) => p.id === saved) ? (saved as Platform) : 'all'
    } catch {
        return 'all'
    }
}
const savePlatform = (platform: Platform | 'all') => {
    try {
        localStorage.setItem(PLATFORM_KEY, platform)
    } catch {
        // not remembered, still applied
    }
}

const newestFirst = (a: Job, b: Job) => (b.publishedAt ?? b.firstSeen).localeCompare(a.publishedAt ?? a.firstSeen)

function App() {
    const jobs = useStorage(getJobs)
    const settings = useStorage(getSettings)
    const lastRun = useStorage(getLastRun)
    const [tab, setTab] = useState<Tab>('apply')
    const [query, setQuery] = useState('')
    const [platform, setPlatform] = useState(loadPlatform)
    const [refreshing, setRefreshing] = useState(false)

    if (!jobs || !settings) return null
    applyLocale(settings)

    // The platform narrows everything below, tab counts included
    const all = Object.values(jobs).filter((j) => platform === 'all' || platformsOf(j, settings).includes(platform))
    const choosePlatform = (p: Platform | 'all') => {
        setPlatform(p)
        savePlatform(p)
    }
    const q = query.toLowerCase()
    const list = all
        .filter((j) => inTab(j, tab, settings))
        .filter((j) => !q || `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q))
        .sort((a, b) => newestFirst(a, b) || b.score - a.score)

    // The page re-renders via the storage listener once the write lands
    // The worker writes jobs (so a running refresh can't undo this); the card updates from the storage change
    const setStatus = (ids: string[], status: JobStatus) =>
        chrome.runtime.sendMessage({ type: 'set-status', ids, status })

    // Only what is on screen (current tab and search), so jobs the user hasn't looked at keep their mark
    const unseen = list.filter((j) => j.status === 'new')
    const markAllSeen = () =>
        setStatus(
            unseen.map((j) => j.id),
            'seen',
        )

    const refresh = async () => {
        setRefreshing(true)
        try {
            await chrome.runtime.sendMessage({ type: 'refresh' })
        } finally {
            setRefreshing(false)
        }
    }

    return (
        <div class="wrap">
            <header>
                <div class="brand">
                    <img src="icon.png" alt="" width={48} height={48} />
                    <div>
                        <h1>IT Job Radar</h1>
                        <RunStatus run={lastRun} />
                    </div>
                </div>
                <div class="actions">
                    <button class="primary" disabled={refreshing} onClick={refresh}>
                        {refreshing ? t.report.refreshing : t.report.refresh}
                    </button>
                    <a class="btn" href="options.html">
                        {t.common.settings}
                    </a>
                </div>
            </header>
            <nav>
                {TABS.map((id) => (
                    <button key={id} aria-pressed={id === tab} onClick={() => setTab(id)}>
                        {t.report.tabs[id]} {all.filter((j) => inTab(j, id, settings)).length}
                    </button>
                ))}
                {unseen.length > 0 && (
                    <button class="mark-seen" onClick={markAllSeen}>
                        {t.report.markSeen(unseen.length)}
                    </button>
                )}
            </nav>
            {!settings.sources.some((s) => s.enabled) && (
                <div class="notice">
                    {t.report.noSources(
                        (s) => (
                            <a href="onboarding.html">{s}</a>
                        ),
                        (s) => (
                            <a href="options.html#sources">{s}</a>
                        ),
                    )}
                </div>
            )}
            {!settings.rules.length && (
                <div class="notice">
                    {t.report.noRules(
                        (s) => (
                            <a href="onboarding.html">{s}</a>
                        ),
                        (s) => (
                            <a href="options.html#filters">{s}</a>
                        ),
                    )}
                </div>
            )}
            <div class="filters">
                <input
                    class="search"
                    type="search"
                    placeholder={t.report.search}
                    value={query}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                />
                <div class="segmented" role="group" aria-label={t.report.platform}>
                    {[{ id: 'all' as const, label: t.report.all }, ...PLATFORMS].map((p) => (
                        <button key={p.id} aria-pressed={p.id === platform} onClick={() => choosePlatform(p.id)}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>
            <main>
                {list.length ? (
                    list.map((j) => (
                        <JobCard
                            key={j.id}
                            job={j}
                            settings={settings}
                            onStatus={(job, status) => setStatus([job.id], status)}
                        />
                    ))
                ) : (
                    <div class="empty">{all.length ? t.report.empty : t.report.firstRun}</div>
                )}
            </main>
            <footer class="page-foot">
                <button class="link" onClick={() => void openIssue('bug')}>
                    {t.feedback.bug}
                </button>
                <button class="link" onClick={() => void openIssue('idea')}>
                    {t.feedback.idea}
                </button>
                <a href={REPO_URL} target="_blank" rel="noopener">
                    GitHub
                </a>
            </footer>
        </div>
    )
}

render(<App />, document.getElementById('app')!)

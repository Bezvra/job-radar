import { getLastRun, getSettings, getJobs, saveJobs, saveLastRun, saveSettings, type RunLog } from './services/storage'
import {
    addPageJob,
    isRelevant,
    mergeDuplicates,
    mergeFeed,
    needsPageCheck,
    prune,
    rescoreAll,
    resetJobs,
} from './core/collect'
import { importJobs } from './core/backup'
import { MAX_SOURCES, MIN_INTERVAL_HOURS } from './core/defaults'
import { parseJobPosting } from './core/jobPage'
import { upgradeRules } from './core/profile'
import { resolveLocale, setLocale, t } from './i18n'
import {
    answerCallback,
    getUpdates,
    jobKey,
    parseCallback,
    sendJobs,
    sendTest,
    type TelegramUpdate,
    updateKeyboard,
} from './services/telegram'
import type { Job, JobStatus, Settings } from './core/types'

const ALARM = 'job-radar-refresh'
/** Restarts the Telegram button polling if Chrome stopped the worker (see pollTelegram) */
const POLL_ALARM = 'job-radar-telegram'

/** The worker's texts (notifications, Telegram, score reasons, run errors) follow the interface language too */
const applyLocale = (settings: Settings) => setLocale(resolveLocale(settings.locale, navigator.language))

/**
 * Only the worker writes `jobs`, and one write at a time: pages send messages (set-status, add-job, settings-changed)
 * instead of saving the whole map themselves, which used to undo a refresh or be undone by it
 */
let jobsWrite: Promise<unknown> = Promise.resolve()
function writeJobs<T>(fn: () => Promise<T>): Promise<T> {
    const next = jobsWrite.then(fn)
    jobsWrite = next.catch(() => undefined)
    return next
}

/**
 * A refresh works on its own copy of the jobs for a minute or so. Statuses set meanwhile are saved right away and
 * also kept here, so its final write carries them over instead of restoring the old ones
 */
const statusesDuringRefresh = new Map<string, JobStatus>()

/**
 * Keeps the alarm if its period is still right (saving the settings used to push the next refresh back by a whole
 * interval). A new one is timed from the last run, so a refresh that's due (or missed while the browser was closed)
 * runs in a minute
 */
async function schedule(): Promise<void> {
    const [{ intervalHours }, lastRun, alarm] = await Promise.all([
        getSettings(),
        getLastRun(),
        chrome.alarms.get(ALARM),
    ])
    await schedulePolling()
    const period = Math.max(MIN_INTERVAL_HOURS, intervalHours) * 60
    if (alarm?.periodInMinutes === period) return
    const sinceLast = lastRun ? (Date.now() - Date.parse(lastRun.at)) / 60_000 : Infinity
    await chrome.alarms.clear(ALARM)
    await chrome.alarms.create(ALARM, { delayInMinutes: Math.max(1, period - sinceLast), periodInMinutes: period })
}

/**
 * Chrome stops an idle service worker after 30 seconds, and fetches and timers don't count as activity, only
 * extension API calls do. A refresh with page checks takes longer than that and used to be cut off before saving
 * anything (the run's jobs, its log), so the next alarm checked the same pages again
 */
function keepAlive(): () => void {
    const timer = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000)
    return () => clearInterval(timer)
}

const telegramReady = ({ telegram: tg }: Settings) => tg.enabled && !!tg.botToken && !!tg.chatId

/** The watchdog alarm runs while Telegram is set up, and starts the polling now */
async function schedulePolling(): Promise<void> {
    if (!telegramReady(await getSettings())) return void (await chrome.alarms.clear(POLL_ALARM))
    if (!(await chrome.alarms.get(POLL_ALARM))) await chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 })
    void pollTelegram()
}

/** Statuses set from the report or Telegram: saved now, and kept by a running refresh. Returns the jobs found */
async function setStatuses(ids: string[], status: JobStatus): Promise<Job[]> {
    if (running) for (const id of ids) statusesDuringRefresh.set(id, status)
    const changed = await writeJobs(async () => {
        const jobs = await getJobs()
        const found = ids.filter((id) => jobs[id]).map((id) => Object.assign(jobs[id], { status }))
        await saveJobs(jobs)
        return found
    })
    await updateBadge()
    return changed
}

/** The bot's offset (the next update to read) is kept per bot, so a new token doesn't skip the new bot's updates */
async function telegramOffset(bot: string): Promise<number> {
    const { tgOffset } = await chrome.storage.local.get('tgOffset')
    const saved = tgOffset as { bot: string; offset: number } | undefined
    return saved?.bot === bot ? saved.offset : 0
}

/** A press of a job's button in Telegram: set the status, say so, and redraw the buttons */
async function handleUpdate(update: TelegramUpdate, settings: Settings): Promise<void> {
    const press = update.callback_query
    const message = press?.message
    // Only presses in the user's own chat; anyone can find a bot and write to it
    if (!press || !message || String(message.chat.id) !== settings.telegram.chatId) return
    const { botToken } = settings.telegram
    const action = parseCallback(press.data)
    if (!action) return void (await answerCallback(botToken, press.id, ''))
    const id = Object.keys(await getJobs()).find((jobId) => jobKey(jobId) === action.key)
    const [job] = id ? await setStatuses([id], action.status) : []
    if (!job) return void (await answerCallback(botToken, press.id, t.telegram.gone))
    await answerCallback(botToken, press.id, t.telegram.done[action.status as 'saved' | 'applied' | 'hidden'])
    await updateKeyboard(botToken, message.chat.id, message.message_id, job)
}

let polling = false

/**
 * The buttons under Telegram jobs: Telegram can't reach an extension, so it asks for presses itself, by long polling
 * (each request waits up to 25s and returns as soon as there's a press), as long as Telegram is set up. That keeps the
 * worker running while the browser is open (keepAlive). Presses made while it's closed wait at Telegram for 24 hours
 * and are applied on the next start. If Chrome stops the worker anyway, POLL_ALARM starts this again within a minute
 */
async function pollTelegram(): Promise<void> {
    if (polling) return
    polling = true
    const release = keepAlive()
    try {
        for (;;) {
            const settings = await getSettings()
            if (!telegramReady(settings)) break
            applyLocale(settings)
            const { botToken } = settings.telegram
            const bot = botToken.split(':')[0]
            let updates: TelegramUpdate[]
            try {
                updates = await getUpdates(botToken, await telegramOffset(bot))
            } catch {
                // Offline, a wrong token, or another getUpdates (the options page's «Знайти chat id»): wait
                await new Promise((r) => setTimeout(r, 30_000))
                continue
            }
            for (const update of updates) {
                await handleUpdate(update, settings).catch(() => undefined)
                await chrome.storage.local.set({ tgOffset: { bot, offset: update.update_id + 1 } })
            }
        }
    } finally {
        release()
        polling = false
    }
}

/** A hung request would hold the refresh (and every later one) until Chrome kills the worker */
const FETCH_TIMEOUT = 30_000

async function updateBadge(): Promise<void> {
    const [jobs, settings] = await Promise.all([getJobs(), getSettings()])
    const n = Object.values(jobs).filter((j) => j.status === 'new' && isRelevant(j, settings)).length
    await chrome.action.setBadgeText({ text: n ? String(n) : '' })
    await chrome.action.setBadgeBackgroundColor({ color: '#2f7d4f' })
}

const PAGE_CHECKS_PER_RUN = 20

/** Read details the RSS lacks (see core/jobPage.ts) from job pages: a few fresh jobs per run, each page once. */
async function checkJobPages(jobs: Record<string, Job>, settings: Settings): Promise<void> {
    const queue = Object.values(jobs)
        .filter((j) => needsPageCheck(j, settings))
        .sort((a, b) => (b.publishedAt ?? b.firstSeen).localeCompare(a.publishedAt ?? a.firstSeen))
        .slice(0, PAGE_CHECKS_PER_RUN)
    for (const job of queue) {
        try {
            const res = await fetch(job.url, { credentials: 'omit', signal: AbortSignal.timeout(FETCH_TIMEOUT) })
            if (!res.ok) continue // e.g. rate limited: retry next run
            job.company = parseJobPosting(await res.text())?.company ?? ''
            job.pageChecked = true
        } catch {
            // network error: retry next run
        }
        await new Promise((r) => setTimeout(r, 700))
    }
}

/** After an update: fix patterns in rules generated by an older version, and rescore so stored jobs get new fields */
async function upgradeAndRescore(): Promise<void> {
    let settings = await getSettings()
    applyLocale(settings)
    const rules = upgradeRules(settings.rules)
    if (rules) {
        settings = { ...settings, rules }
        await saveSettings(settings)
    }
    await writeJobs(async () => {
        const jobs = await getJobs()
        prune(jobs, settings.sources)
        rescoreAll(jobs, settings)
        await saveJobs(jobs)
    })
    await updateBadge()
}

let running: Promise<RunLog> | null = null

async function refresh(): Promise<RunLog> {
    statusesDuringRefresh.clear()
    const settings = await getSettings()
    applyLocale(settings)
    const jobs = await getJobs()
    const log: RunLog = { at: new Date().toISOString(), results: [], newRelevant: 0 }

    const relevant: Job[] = []
    // The pages refuse to save more; settings from before that limit are cut here
    for (const src of settings.sources.filter((s) => s.enabled).slice(0, MAX_SOURCES)) {
        try {
            const res = await fetch(src.url, {
                credentials: 'omit',
                cache: 'no-store',
                signal: AbortSignal.timeout(FETCH_TIMEOUT),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const xml = await res.text()
            const { added, count } = mergeFeed(jobs, xml, src.id, settings)
            relevant.push(...added.filter((j) => isRelevant(j, settings)))
            log.newRelevant = relevant.length
            log.results.push({ sourceId: src.id, name: src.name, ok: true, count })
            if (count === 0) log.results[log.results.length - 1].error = t.run.emptyFeed
        } catch (e) {
            log.results.push({ sourceId: src.id, name: src.name, ok: false, count: 0, error: String(e) })
        }
        await new Promise((r) => setTimeout(r, 1500)) // be polite to the sites
    }

    await checkJobPages(jobs, settings)
    // Companies found on job pages can reveal copies across sites; a merged-away copy isn't news
    const merged = new Set(mergeDuplicates(jobs))
    if (merged.size) {
        relevant.splice(0, relevant.length, ...relevant.filter((j) => !merged.has(j.id)))
        log.newRelevant = relevant.length
    }
    await writeJobs(async () => {
        // What changed while this ran: statuses set in the report, settings saved (rules, sources)
        for (const [id, status] of statusesDuringRefresh) if (jobs[id]) jobs[id].status = status
        statusesDuringRefresh.clear()
        const latest = await getSettings()
        applyLocale(latest)
        prune(jobs, latest.sources)
        rescoreAll(jobs, latest)
        await saveJobs(jobs)
    })
    await saveLastRun(log)
    await updateBadge()

    try {
        await sendJobs(relevant, settings)
    } catch (e) {
        log.results.push({ sourceId: 'telegram', name: 'Telegram', ok: false, count: 0, error: String(e) })
        await saveLastRun(log)
    }

    if (settings.notify && log.newRelevant > 0) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'IT Job Radar',
            message: t.notify.newJobs(log.newRelevant),
        })
    }
    return log
}

function refreshOnce(): Promise<RunLog> {
    if (running) return running
    const release = keepAlive()
    running = refresh().finally(() => {
        release()
        running = null
    })
    return running
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
    void schedule()
    // First install: set up filters from the user's CV instead of the built-in defaults
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') })
    }
    if (reason === chrome.runtime.OnInstalledReason.UPDATE) void upgradeAndRescore()
})
chrome.runtime.onStartup.addListener(() => void schedule())
chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM) void refreshOnce()
    if (a.name === POLL_ALARM) void pollTelegram()
})
// Any wake of the worker (an alarm, a message, the browser starting) resumes the Telegram polling
void pollTelegram()
chrome.notifications.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('report.html') }))

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === 'refresh') {
        refreshOnce().then(reply)
        return true
    }
    if (msg?.type === 'settings-changed') {
        ;(async () => {
            // A refresh in flight would write the dropped jobs back when it ends (rules and sources it re-reads itself)
            if (msg.reset) await running
            await writeJobs(async () => {
                const [jobs, settings] = await Promise.all([getJobs(), getSettings()])
                applyLocale(settings) // a new language: the score reasons are made again in it
                if (msg.reset) resetJobs(jobs)
                prune(jobs, settings.sources) // a removed source takes its jobs with it
                rescoreAll(jobs, settings)
                await saveJobs(jobs)
            })
            await schedule()
            await updateBadge()
            reply({ ok: true })
        })()
        return true
    }
    if (msg?.type === 'telegram-test') {
        getSettings()
            .then((settings) => {
                applyLocale(settings)
                return sendTest(settings)
            })
            .then(
                () => reply({ ok: true }),
                (e) => reply({ ok: false, error: String(e) }),
            )
        return true
    }
    // A status set in the report (one job, or «Позначити переглянутими» for many): saved now, kept by a running refresh
    if (msg?.type === 'set-status') {
        const { ids, status } = msg as { ids: string[]; status: JobStatus }
        void setStatuses(ids, status).then(() => reply({ ok: true }))
        return true
    }
    // A backup file from the options page: its settings replace the current ones, its saved and applied jobs are added
    if (msg?.type === 'import') {
        ;(async () => {
            await running // its final write would drop the imported jobs of sources it didn't know
            const imported = msg.settings as Settings
            const settings = { ...imported, rules: upgradeRules(imported.rules) ?? imported.rules }
            await saveSettings(settings)
            applyLocale(settings)
            await writeJobs(async () => {
                const jobs = await getJobs()
                importJobs(jobs, msg.jobs as Job[])
                prune(jobs, settings.sources)
                rescoreAll(jobs, settings)
                await saveJobs(jobs)
            })
            await schedule()
            await updateBadge()
            reply({ ok: true })
        })()
        return true
    }
    // A job the user saved from the popup (a page in their tab): a new job a running refresh doesn't know, so wait for it
    if (msg?.type === 'add-job') {
        ;(async () => {
            await running
            const job = await writeJobs(async () => {
                const jobs = await getJobs()
                const added = addPageJob(jobs, msg.job as Job)
                await saveJobs(jobs)
                return added
            })
            await updateBadge()
            reply({ ok: true, job })
        })()
        return true
    }
})

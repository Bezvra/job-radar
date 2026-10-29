import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { alarms, fetched, listeners, notifications, posted, reset, responses, send, store } from './chrome'
import '../src/background'
import { MAX_SOURCES } from '../src/core/defaults'
import { jobKey } from '../src/services/telegram'
import type { Job, Settings, Source } from '../src/core/types'
import { RULES, SETTINGS } from './fixtures'

const ALARM = 'job-radar-refresh'

/** A Djinni-like feed (no company, like the real one) with jobs published now, so they're fresh */
const feed = (...ids: number[]) =>
    `<?xml version="1.0"?><rss><channel>${ids
        .map(
            (id) =>
                `<item><title>Senior React Developer ${id}</title><link>https://djinni.co/jobs/${id}-react/</link>` +
                `<description>React, TypeScript. Remote</description><pubDate>${new Date().toUTCString()}</pubDate></item>`,
        )
        .join('')}</channel></rss>`

const page = (company: string) =>
    `<script type="application/ld+json">{"@type":"JobPosting","hiringOrganization":{"name":"${company}"}}</script>`

const source = (id: string, fetchPages = false): Source => ({
    id,
    name: id,
    url: `https://djinni.co/jobs/rss/?primary_keyword=${id}`,
    enabled: true,
    fetchPages,
})

const settings = (more: Partial<Settings> = {}): Settings => ({
    ...SETTINGS,
    sources: [source('React.js', true)],
    notify: true,
    ...more,
})

const jobs = () => store.jobs as Record<string, Job>

beforeEach(reset)

test('worker: a refresh fetches the feeds and the job pages, then saves the jobs and the run', async () => {
    store.settings = settings()
    responses.set(source('React.js').url, feed(1, 2))
    responses.set('https://djinni.co/jobs/1-react', page('Acme'))
    responses.set('https://djinni.co/jobs/2-react', page('Beta'))

    const log = await send({ type: 'refresh' })

    assert.equal(log.results[0].count, 2)
    assert.deepEqual(
        Object.values(jobs()).map((j) => j.company),
        ['Acme', 'Beta'],
    )
    assert.ok(Object.values(jobs()).every((j) => j.pageChecked && j.status === 'new'))
    assert.equal((store.lastRun as { at: string }).at, log.at)
    assert.equal(notifications.length, 1, 'senior React remote jobs are relevant')
})

test('worker: fetches no more than MAX_SOURCES enabled feeds, even from older settings', async () => {
    const sources = Array.from({ length: MAX_SOURCES + 3 }, (_, i) => source(`k${i}`))
    store.settings = settings({ sources: [{ ...source('off'), enabled: false }, ...sources] })
    await send({ type: 'refresh' })
    assert.equal(fetched.length, MAX_SOURCES)
    assert.ok(!fetched.includes(source('off').url))
})

test('worker: a status set while a refresh runs survives its final write', async () => {
    store.settings = settings({ sources: [source('React.js')] })
    responses.set(source('React.js').url, feed(1))
    await send({ type: 'refresh' })
    const [id] = Object.keys(jobs())

    const refreshing = send({ type: 'refresh' })
    await send({ type: 'set-status', ids: [id], status: 'saved' })
    assert.equal(jobs()[id].status, 'saved', 'saved right away')
    await refreshing
    assert.equal(jobs()[id].status, 'saved', 'and not reverted by the refresh')
})

test('worker: saving the settings keeps the alarm; a new interval is timed from the last run', async () => {
    store.settings = settings()
    await send({ type: 'settings-changed' })
    const first = alarms.get(ALARM)!
    assert.equal(first.periodInMinutes, 180)
    assert.ok(first.scheduledTime - Date.now() < 2 * 60_000, 'never run: soon')

    await send({ type: 'settings-changed' })
    assert.equal(alarms.get(ALARM), first, 'same period: the alarm stays')

    store.lastRun = { at: new Date(Date.now() - 60 * 60_000).toISOString(), results: [], newRelevant: 0 }
    store.settings = settings({ intervalHours: 4 })
    await send({ type: 'settings-changed' })
    const next = alarms.get(ALARM)!
    assert.equal(next.periodInMinutes, 240)
    assert.ok(Math.abs(next.scheduledTime - Date.now() - 180 * 60_000) < 60_000, 'four hours after the last run')

    store.settings = settings({ intervalHours: 1 })
    await send({ type: 'settings-changed' })
    assert.equal(alarms.get(ALARM)!.periodInMinutes, 120, 'at least two hours')
})

test('worker: the wizard’s reset drops jobs except saved and applied ones', async () => {
    store.settings = settings({ sources: [source('React.js')] })
    responses.set(source('React.js').url, feed(1, 2, 3))
    await send({ type: 'refresh' })
    const [a, b] = Object.keys(jobs())
    await send({ type: 'set-status', ids: [a], status: 'saved' })
    await send({ type: 'set-status', ids: [b], status: 'applied' })

    await send({ type: 'settings-changed', reset: true })
    assert.deepEqual(Object.keys(jobs()).sort(), [a, b].sort())
})

test('worker: an import replaces the settings, upgrades old rules and adds the jobs', async () => {
    store.settings = settings()
    const imported = settings({
        applyThreshold: 70,
        rules: [...RULES, { pattern: 'x', weight: -20, label: 'Англійська вище B2' }],
    })
    const job: Job = {
        id: 'https://www.linkedin.com/jobs/view/1/',
        title: 'Senior React Developer',
        company: 'Acme',
        url: 'https://www.linkedin.com/jobs/view/1/',
        description: 'React',
        publishedAt: null,
        sourceIds: [],
        firstSeen: new Date().toISOString(),
        score: 0,
        reasons: [],
        status: 'saved',
    }
    await send({ type: 'import', settings: imported, jobs: [job] })

    const saved = store.settings as Settings
    assert.equal(saved.applyThreshold, 70)
    assert.deepEqual(saved.rules.at(-1)!.labelKey, { id: 'languageAbove', args: ['en', 'B2'] })
    assert.equal(jobs()[job.id].status, 'saved')
    assert.ok(jobs()[job.id].score > 0, 'rescored')
})

test('worker: registers its alarm on install and on startup', async () => {
    store.settings = settings()
    listeners.startup()
    await new Promise((r) => setTimeout(r, 10))
    assert.ok(alarms.has(ALARM))
})

test('worker: a button pressed in Telegram sets the job’s status and redraws its buttons', async () => {
    const api = 'https://api.telegram.org/bot1:abc/'
    const telegram = { enabled: true, botToken: '1:abc', chatId: '42' }
    store.settings = settings({ locale: 'uk', telegram })
    responses.set(source('React.js').url, feed(1, 2))
    await send({ type: 'refresh' })
    const [a, b] = Object.keys(jobs())

    const press = (updateId: number, chat: number, data: string) => ({
        update_id: updateId,
        callback_query: { id: `q${updateId}`, data, message: { message_id: 7, chat: { id: chat } } },
    })
    let calls = 0
    const done = new Promise<void>((resolve) =>
        responses.set(`${api}getUpdates`, (body) => {
            calls++
            if (calls === 1) {
                assert.equal(body.offset, 0)
                assert.equal(body.timeout, 25, 'long polling')
                return JSON.stringify({
                    ok: true,
                    result: [press(10, 42, `s:${jobKey(a)}`), press(11, 99, `h:${jobKey(b)}`)],
                })
            }
            // Stop the loop: Telegram turned off
            store.settings = settings({ locale: 'uk', telegram: { ...telegram, enabled: false } })
            resolve()
            return JSON.stringify({ ok: true, result: [] })
        }),
    )
    responses.set(`${api}answerCallbackQuery`, '{"ok":true}')
    responses.set(`${api}editMessageReplyMarkup`, '{"ok":true}')

    await send({ type: 'settings-changed' }) // starts the polling, as saving Telegram settings does
    await done
    await new Promise((r) => setTimeout(r, 10))

    assert.equal(jobs()[a].status, 'saved')
    assert.equal(jobs()[b].status, 'new', 'a press from someone else’s chat is ignored')
    const answer = posted.find((p) => p.url.endsWith('answerCallbackQuery'))!.body
    assert.deepEqual(answer, { callback_query_id: 'q10', text: 'Збережено у звіті ✓' })
    const edit = posted.find((p) => p.url.endsWith('editMessageReplyMarkup'))!.body
    assert.equal(edit.message_id, 7)
    assert.deepEqual(
        edit.reply_markup.inline_keyboard[1].map((k: { text: string }) => k.text),
        ['✓ Збережено', '📨 Подав', '🙈 Сховати'],
    )
    assert.deepEqual(store.tgOffset, { bot: '1', offset: 12 }, 'both presses confirmed')
    assert.ok(alarms.has('job-radar-telegram'), 'the watchdog alarm runs while Telegram is set up')
    await send({ type: 'settings-changed' })
    assert.ok(!alarms.has('job-radar-telegram'), 'and goes when it isn’t')
})

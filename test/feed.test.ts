import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRss } from '../src/core/rss'
import { normalize, splitTitle } from '../src/core/normalize'
import { isFresh, isRelevant, mergeDuplicates, mergeFeed, needsPageCheck, prune, resetJobs } from '../src/core/collect'
import { parseJobPosting } from '../src/core/jobPage'
import { scoreJob } from '../src/core/scoring'
import { formatJob, jobKey, jobKeyboard, parseCallback } from '../src/services/telegram'
import type { Job } from '../src/core/types'
import { RULES, SETTINGS, DJINNI, DOU } from './fixtures'

test('parses Djinni RSS incl. CDATA, entities, dc:creator', () => {
    const items = parseRss(DJINNI)
    assert.equal(items.length, 2)
    assert.equal(items[0].author, 'Acme Labs')
    assert.match(items[0].description, /Remote, Ukraine & EU/)
    assert.doesNotMatch(items[0].description, /<li>/)
})

test('parses DOU RSS with escaped HTML', () => {
    const items = parseRss(DOU)
    assert.equal(items.length, 2)
    assert.equal(items[0].description, 'React, TypeScript, Next.js')
})

test('splits DOU title into role + company', () => {
    assert.deepEqual(splitTitle('Senior Front-end Developer в Acme Labs, віддалено', null), {
        title: 'Senior Front-end Developer',
        company: 'Acme Labs',
        location: 'віддалено',
    })
    assert.deepEqual(splitTitle('Senior React Developer', 'Acme'), { title: 'Senior React Developer', company: 'Acme' })
})

test('DOU location from title counts for scoring', () => {
    const n = normalize(parseRss(DOU)[0])
    assert.ok(scoreJob(n.title, n.description, RULES).reasons.some((r) => r.label === 'Remote'))
})

test('strips tracking params from URL', () => {
    assert.equal(normalize(parseRss(DJINNI)[0]).url, 'https://djinni.co/jobs/812345-senior-react-developer')
})

test('merges feeds and dedupes same job across Djinni and DOU', () => {
    const jobs: Record<string, Job> = {}
    const a = mergeFeed(jobs, DJINNI, 'djinni-react', SETTINGS)
    const b = mergeFeed(jobs, DJINNI, 'djinni-react', SETTINGS)
    assert.equal(a.added.length, 2)
    assert.equal(b.added.length, 0, 'second run adds nothing')
    mergeFeed(jobs, DOU, 'dou-frontend', SETTINGS)
    assert.equal(Object.keys(jobs).length, 4)
})

test('prune keeps saved/applied, drops stale', () => {
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 's', SETTINGS, new Date('2026-08-01'))
    const [first] = Object.values(jobs)
    first.status = 'applied'
    prune(jobs, [{ id: 's', name: 'S', url: 'https://djinni.co/jobs/rss/', enabled: true }], new Date('2026-10-27'))
    assert.deepEqual(Object.keys(jobs), [first.id])
})

test('re-running the wizard keeps only saved and applied jobs', () => {
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 's', SETTINGS)
    mergeFeed(jobs, DOU, 's', SETTINGS)
    const [saved, applied] = Object.values(jobs)
    saved.status = 'saved'
    applied.status = 'applied'
    resetJobs(jobs)
    assert.deepEqual(Object.keys(jobs).sort(), [saved.id, applied.id].sort())
})

test('prune drops jobs whose every source was removed, unless saved or applied', () => {
    const now = new Date('2026-10-27T12:00:00Z')
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 'old-frontend', SETTINGS, now)
    mergeFeed(jobs, DOU, 'old-frontend', SETTINGS, now)
    const [saved, both, ...rest] = Object.values(jobs)
    saved.status = 'saved'
    both.sourceIds.push('backend')
    const backend = { id: 'backend', name: 'B', url: 'https://djinni.co/jobs/rss/', enabled: false }
    prune(jobs, [backend], now)
    assert.ok(rest.length > 0)
    assert.deepEqual(Object.keys(jobs).sort(), [saved.id, both.id].sort(), 'a disabled source still keeps its jobs')
})

test('freshness uses publish date, falls back to first seen', () => {
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 's', SETTINGS, new Date('2026-10-26T12:00:00Z'))
    const j = Object.values(jobs)[0] // published 2026-10-26 10:00 UTC
    assert.ok(isFresh(j, 3, new Date('2026-10-29T09:00:00Z')))
    assert.ok(!isFresh(j, 3, new Date('2026-10-29T11:00:00Z')))
    j.publishedAt = null // first seen 2026-10-26 12:00 UTC
    assert.ok(isFresh(j, 3, new Date('2026-10-29T11:00:00Z')))
})

test('stale jobs are not relevant even with a high score', () => {
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 's', SETTINGS)
    const good = Object.values(jobs).find((j) => j.score >= SETTINGS.applyThreshold)!
    assert.ok(isRelevant(good, SETTINGS, new Date('2026-10-27T00:00:00Z')))
    assert.ok(!isRelevant(good, SETTINGS, new Date('2026-11-05T00:00:00Z')))
})

test('telegram message escapes HTML', () => {
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 's', SETTINGS)
    const j = Object.values(jobs)[0]
    j.title = 'React <Lead> & co'
    const msg = formatJob(j)
    assert.match(msg, /React &lt;Lead&gt; &amp; co/)
    assert.match(msg, /<i>Кнопки спрацюють/)
    // Buttons: open, then save / applied / hide carrying a short key of the job that parses back
    const keys = jobKeyboard({ ...j, status: 'applied' }).inline_keyboard as {
        text: string
        url?: string
        callback_data?: string
    }[][]
    assert.equal(keys[0][0].url, j.url)
    assert.deepEqual(
        keys[1].map((k) => k.text),
        ['💾 Зберегти', '✓ Подав', '🙈 Сховати'],
    )
    assert.ok(keys[1].every((k) => k.callback_data!.length <= 64))
    assert.deepEqual(parseCallback(keys[1][2].callback_data), { status: 'hidden', key: jobKey(j.id) })
    assert.equal(parseCallback('x:1'), null)
    console.log(
        '   preview:\n' +
            msg
                .split('\n')
                .map((l) => '     ' + l)
                .join('\n'),
    )
})

test('job pages are checked only for sources that allow it', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 'djinni-react', SETTINGS, now)
    const j = Object.values(jobs)[1] // no dc:creator → no company
    assert.equal(j.company, '')
    assert.ok(needsPageCheck(j, SETTINGS, now))
    const off = { ...SETTINGS, sources: SETTINGS.sources.map((s) => ({ ...s, fetchPages: false })) }
    assert.ok(!needsPageCheck(j, off, now))
    j.pageChecked = true
    assert.ok(!needsPageCheck(j, SETTINGS, now), 'each page only once')
})

test('extracts company from JSON-LD JobPosting', () => {
    const html = `<html><script type="application/ld+json">{"@context":"https://schema.org/","@type":"JobPosting","hiringOrganization":{"@type":"Organization","name":" Innotechfy "}}</script></html>`
    assert.deepEqual(parseJobPosting(html), { company: 'Innotechfy' })
    assert.equal(parseJobPosting('<script type="application/ld+json">{bad</script>'), null)
})

test('copies of one job on Djinni and DOU become one job with both links', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    const rss = (title: string, link: string, creator = '') =>
        `<rss><channel><item><title>${title}</title><link>${link}</link><description>React</description>` +
        `<pubDate>Mon, 26 Oct 2026 10:00:00 +0000</pubDate>${creator && `<dc:creator>${creator}</dc:creator>`}</item></channel></rss>`
    // Djinni has no company in the feed, so its copy is stored apart until the job page fills it in
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, rss('Senior React Developer', 'https://djinni.co/jobs/1-react/'), 'djinni-react', SETTINGS, now)
    mergeFeed(
        jobs,
        rss('Senior React Developer в Acme, віддалено', 'https://jobs.dou.ua/vacancies/2/'),
        'dou-react',
        SETTINGS,
        now,
    )
    assert.equal(Object.keys(jobs).length, 2)
    const djinni = jobs['https://djinni.co/jobs/1-react']
    djinni.company = 'Acme'
    jobs['https://jobs.dou.ua/vacancies/2'].status = 'saved'
    assert.deepEqual(mergeDuplicates(jobs), ['https://jobs.dou.ua/vacancies/2'])
    assert.deepEqual(Object.keys(jobs), ['https://djinni.co/jobs/1-react'])
    assert.deepEqual(djinni.alternates, ['https://jobs.dou.ua/vacancies/2'])
    assert.deepEqual(djinni.sourceIds, ['djinni-react', 'dou-react'])
    assert.equal(djinni.status, 'saved', 'the furthest status wins')
    // Once the company is known, the next DOU run lands on the same job
    mergeFeed(
        jobs,
        rss('Senior React Developer в Acme, віддалено', 'https://jobs.dou.ua/vacancies/2/'),
        'dou-frontend',
        SETTINGS,
        now,
    )
    assert.equal(Object.keys(jobs).length, 1)
    assert.deepEqual(djinni.alternates, ['https://jobs.dou.ua/vacancies/2'])
    // Two postings on the same site with the same title are different jobs
    const second = { ...djinni, id: 'https://djinni.co/jobs/3-react', url: 'https://djinni.co/jobs/3-react' }
    jobs[second.id] = { ...second, firstSeen: '2026-10-27T00:00:00Z', alternates: undefined }
    assert.deepEqual(mergeDuplicates(jobs), [])
})

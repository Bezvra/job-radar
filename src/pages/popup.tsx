import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { isFresh, isRelevant, pageToJob } from '../core/collect'
import { jobFromPage, type PageJob, type PageSnapshot, selectorsFor, type SiteSelectors } from '../core/pageJob'
import { belowMinSalary, formatSalary } from '../core/salary'
import type { JobStatus } from '../core/types'
import { getJobs, getSettings } from '../services/storage'
import { useStorage } from './hooks/useStorage'
import { t } from '../i18n'
import { ago, applyLocale, formatWeight, platformLabel } from './utils'

/**
 * Runs in the user's tab (injected on their click, through activeTab), so it must not use anything from outside its
 * own body. It only reads the page: no requests, nothing changed.
 */
function snapshotPage(selectors: SiteSelectors): PageSnapshot {
    const text = (el: Element | null | undefined) => ((el as HTMLElement | null)?.innerText ?? '').trim()
    const find = (list: string[], root: ParentNode = document) => {
        for (const s of list) for (const el of root.querySelectorAll(s)) if (text(el)) return el
        return null
    }
    const titleEl = find(selectors.title)
    let descEl = find(selectors.description)
    if (!descEl && selectors.descriptionHeading) {
        const re = new RegExp(selectors.descriptionHeading, 'i')
        const heading = [...document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')].find((h) => re.test(text(h)))
        descEl = heading?.closest('article, section') ?? null
        // No article: the first ancestor with real text besides the heading (it may sit in wrappers of its own)
        if (heading && !descEl) {
            descEl = heading
            while (descEl.parentElement && text(descEl).length < text(heading).length + 100)
                descEl = descEl.parentElement
        }
    }
    // Neither: the job card is the first block around the title with the company link in it
    // (only for sites without a description heading: elsewhere a missed description should fall back to the page)
    if (!descEl && titleEl && selectors.cardCompany && !selectors.descriptionHeading) {
        let el: Element | null = titleEl
        while (el && !el.querySelector(selectors.cardCompany)) el = el.parentElement
        // That may be just the header (title, company, salary). Past wrappers with the same text, the block that at
        // least doubles it adds the description; stop at the next smaller step, which only adds the side lists
        const grows = (by: number) => el?.parentElement && text(el.parentElement).length >= by * text(el).length
        while (el?.parentElement && text(el.parentElement).length <= text(el).length) el = el.parentElement
        while (grows(2)) el = el!.parentElement
        descEl = el
    }
    // The top card: the largest block around the title that doesn't reach the description
    let card: Element | null = null
    // (none when the description block holds the title too, as on Work.ua: that block is the whole job card)
    if (titleEl && descEl && !titleEl.contains(descEl) && !descEl.contains(titleEl)) {
        card = titleEl
        while (card.parentElement && !card.parentElement.contains(descEl)) card = card.parentElement
    }
    // Where the company, salary and workplace type are: the card, or else the job's pane around the description
    let scope: Element | null = card ?? (titleEl && descEl?.contains(titleEl) ? descEl : null)
    if (!scope && descEl) {
        scope = descEl
        while (scope.parentElement && text(scope.parentElement).length < text(descEl).length + 100)
            scope = scope.parentElement
        scope = scope.parentElement ?? scope
    }
    const lone = (pattern: string, outside?: Element | null) => {
        if (!pattern || !scope) return null
        const re = new RegExp(pattern, 'i')
        return [...scope.querySelectorAll('a, button, span, li, p, strong, b, div')].find(
            (el) => !outside?.contains(el) && el.children.length <= 2 && re.test(text(el)),
        )
    }
    const top = selectors.top.map((s) => text(document.querySelector(s))).filter(Boolean)
    if (!top.length && card) top.push(text(card))
    if (!top.length) top.push(text(lone(selectors.workplace, descEl)))
    return {
        url: location.href,
        title: document.title,
        ldJson: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ''),
        picked: {
            title: text(titleEl),
            company: text(
                find(selectors.company) ??
                    (scope && selectors.cardCompany ? find([selectors.cardCompany], scope) : null),
            ),
            top: top.filter(Boolean).join('\n').slice(0, 1500),
            salary: text(find(selectors.salary) ?? lone(selectors.salaryText)),
            description: text(descEl),
        },
        h1: text(document.querySelector('h1')),
        selection: String(getSelection() ?? ''),
        text: text(document.querySelector('main') ?? document.body).slice(0, 20000),
    }
}

/** A message key, not text: the tab is read before the settings (and so the language) are loaded */
type Read = { page: PageJob } | { problem: 'openJobPage' | 'noJob' | 'blocked' } | null

async function readTab(): Promise<Read> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !/^https?:/.test(tab.url ?? '')) {
        return { problem: 'openJobPage' }
    }
    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: snapshotPage,
            args: [selectorsFor(tab.url!)],
        })
        const page = jobFromPage(res.result as PageSnapshot)
        return page ? { page } : { problem: 'noJob' }
    } catch {
        return { problem: 'blocked' }
    }
}

function App() {
    const settings = useStorage(getSettings)
    const jobs = useStorage(getJobs)
    const [read, setRead] = useState<Read>(null)
    const [busy, setBusy] = useState(false)
    useEffect(() => void readTab().then(setRead), [])

    const openReport = () => {
        void chrome.tabs.create({ url: chrome.runtime.getURL('report.html') })
        window.close()
    }
    const newCount =
        settings && jobs ? Object.values(jobs).filter((j) => j.status === 'new' && isRelevant(j, settings)).length : 0

    if (settings) applyLocale(settings)
    let body
    if (!settings || !jobs || !read) body = <div class="hint">{t.popup.reading}</div>
    else if ('problem' in read) body = <div class="hint">{t.popup[read.problem]}</div>
    else {
        const job = pageToJob(read.page, settings, 'seen')
        const known = jobs[job.id]
        const level = job.score >= settings.applyThreshold ? 'good' : job.score >= settings.hideBelow ? 'mid' : 'bad'
        const verdict = t.popup.verdict[level]
        const inReport =
            known && (known.status === 'saved' || known.status === 'applied') && t.report.tabs[known.status]
        const underpaid = belowMinSalary(job.salary, settings.minSalary)
        const save = async (status: JobStatus) => {
            setBusy(true)
            await chrome.runtime.sendMessage({ type: 'add-job', job: { ...job, status } })
            setBusy(false)
        }
        body = (
            <>
                {!settings.rules.length && (
                    <div class="notice">
                        {t.popup.noRules((s) => (
                            <a href="onboarding.html" target="_blank">
                                {s}
                            </a>
                        ))}
                    </div>
                )}
                <div class="popup-head">
                    <div class={`score ${level}`} title={t.common.score}>
                        {job.score}
                    </div>
                    <div>
                        <div class="popup-verdict">{verdict}</div>
                        <div class="title">{job.title}</div>
                        <div class="meta">
                            {[
                                job.company,
                                job.salary && (
                                    <span class={`salary${underpaid ? ' low' : ''}`}>{formatSalary(job.salary)}</span>
                                ),
                                job.publishedAt && ago(job.publishedAt),
                                platformLabel(job.url),
                            ]
                                .filter(Boolean)
                                .map((part, i) => (
                                    <span key={i}>
                                        {i > 0 && ' · '}
                                        {part}
                                    </span>
                                ))}
                        </div>
                    </div>
                </div>
                {read.page.guessed && <div class="hint warn">{t.popup.guessed}</div>}
                {job.publishedAt && !isFresh(job, settings.maxAgeDays) && (
                    <div class="hint warn">{t.popup.stale(settings.maxAgeDays)}</div>
                )}
                {underpaid && <div class="hint warn">{t.popup.underpaid(settings.minSalary)}</div>}
                <div class="chips">
                    {job.reasons.map((r) => (
                        <span key={r.label} class={`chip ${r.weight >= 0 ? 'pos' : 'neg'}`}>
                            {formatWeight(r.weight)} {r.label}
                        </span>
                    ))}
                    {job.neutral?.map((name) => (
                        <span key={name} class="chip neutral" title={t.common.neutralTech}>
                            {name}
                        </span>
                    ))}
                </div>
                <div class="actions">
                    {inReport ? <span class="hint">{t.popup.inReport(inReport)}</span> : null}
                    {known?.status !== 'saved' && (
                        <button disabled={busy} onClick={() => void save('saved')}>
                            {t.common.save}
                        </button>
                    )}
                    {known?.status !== 'applied' && (
                        <button disabled={busy} onClick={() => void save('applied')}>
                            {t.common.applied}
                        </button>
                    )}
                </div>
            </>
        )
    }

    return (
        <div class="popup">
            {body}
            <div class="popup-foot">
                <button class="primary" onClick={openReport}>
                    {t.popup.openReport(newCount)}
                </button>
                <button onClick={() => void chrome.runtime.openOptionsPage()}>{t.common.settings}</button>
            </div>
        </div>
    )
}

render(<App />, document.getElementById('app')!)

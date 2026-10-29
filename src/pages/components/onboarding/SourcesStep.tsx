import { useState } from 'preact/hooks'
import { feedName, toFeedUrl, unknownDjinniKeywords } from '../../../core/feeds'
import { parseRss } from '../../../core/rss'
import { t } from '../../../i18n'
import { type Platform, PLATFORMS, platformLabel } from '../../utils'

/** A feed offered on this step: suggested from the stack for one site, or pasted by the user */
export interface FeedRow {
    name: string
    url: string
    checked: boolean
    /** Shown under the row: how many jobs the feed has now, or a warning */
    note?: string
    /** The note is a warning: the feed likely won't filter */
    warn?: boolean
    /** Pasted by the user: listed under «Свої джерела», saved whichever sites are ticked */
    custom?: boolean
}

interface Props {
    feeds: FeedRow[]
    onChange: (feeds: FeedRow[]) => void
    /** Sites to search; a site's suggested feeds show (and are saved) only while it's ticked */
    sites: Platform[]
    onSites: (sites: Platform[]) => void
}

const platformOf = (f: FeedRow) => PLATFORMS.find((p) => p.label === platformLabel(f.url))?.id

/** The feeds a finished wizard saves: ticked custom ones, and ticked suggestions of the ticked sites */
export const chosenFeeds = (feeds: FeedRow[], sites: Platform[]) =>
    feeds.filter((f) => f.checked && (f.custom || sites.includes(platformOf(f)!)))

/** One request to the feed, like a refresh does: no cookies, so it isn't tied to the user's account on the site */
async function countJobs(url: string): Promise<number> {
    const res = await fetch(url, { credentials: 'omit', cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return parseRss(await res.text()).length
}

export function SourcesStep({ feeds, onChange, sites, onSites }: Props) {
    const [link, setLink] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const update = (url: string, patch: Partial<FeedRow>) =>
        onChange(feeds.map((f) => (f.url === url ? { ...f, ...patch } : f)))
    const toggleSite = (id: Platform, on: boolean) =>
        onSites(
            on
                ? PLATFORMS.map((p) => p.id).filter((x) => x === id || sites.includes(x))
                : sites.filter((x) => x !== id),
        )

    const add = async () => {
        const url = toFeedUrl(link)
        if (!url) return setError(t.feedsStep.needSearchUrl)
        setError('')
        // Already suggested: it becomes the user's own, so it stays whichever sites are ticked
        if (feeds.some((f) => f.url === url)) {
            update(url, { custom: true, checked: true })
            return setLink('')
        }
        setBusy(true)
        const unknown = unknownDjinniKeywords(url)
        let note: string
        if (unknown.length) {
            // Known without a request: Djinni would ignore the key and return every category
            note = t.feedsStep.unknownDjinni(unknown.map((k) => `«${k}»`).join(', '))
        } else {
            try {
                const n = await countJobs(url)
                // A feed holds at most the latest 100 jobs
                note = t.feedsStep.count(n)
            } catch (e) {
                note = t.feedsStep.checkFailed((e as Error).message)
            }
        }
        onChange([
            ...feeds,
            { name: feedName(url), url, checked: !unknown.length, note, warn: !!unknown.length, custom: true },
        ])
        setLink('')
        setBusy(false)
    }

    const row = (f: FeedRow) => (
        <div key={f.url} class={`editor-item feed-row${f.checked ? '' : ' is-off'}`}>
            <input
                type="checkbox"
                aria-label={f.name}
                checked={f.checked}
                onChange={(e) => update(f.url, { checked: e.currentTarget.checked })}
            />
            <div>
                <strong>{f.name}</strong>
                <div class="hint feed-url">{f.url}</div>
                {f.note && <div class={`hint${f.warn ? ' warn' : ''}`}>{f.note}</div>}
            </div>
            {f.custom && (
                <button
                    class="icon"
                    title={t.common.remove}
                    onClick={() => onChange(feeds.filter((x) => x.url !== f.url))}
                >
                    ×
                </button>
            )}
        </div>
    )
    const custom = feeds.filter((f) => f.custom)

    return (
        <>
            <fieldset>
                <legend>{t.feedsStep.where}</legend>
                <div class="hint">{t.feedsStep.whereHint}</div>
                {PLATFORMS.map((p) => {
                    const on = sites.includes(p.id)
                    const suggested = feeds.filter((f) => !f.custom && platformOf(f) === p.id)
                    return (
                        <div key={p.id} class={`site-block${on ? ' is-open' : ''}`}>
                            <label class="site-head">
                                <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={(e) => toggleSite(p.id, e.currentTarget.checked)}
                                />
                                <div>
                                    <strong>{p.label}</strong>
                                    <div class="hint">{t.feedsStep.siteHints[p.id]}</div>
                                </div>
                            </label>
                            {on && (
                                <div class="editor">
                                    {suggested.map(row)}
                                    {!suggested.length && <div class="hint">{t.feedsStep.noSuggestions(p.label)}</div>}
                                </div>
                            )}
                        </div>
                    )
                })}
            </fieldset>

            <fieldset>
                <legend>{t.feedsStep.custom}</legend>
                <div class="hint">
                    {t.feedsStep.customHint(
                        (s) => (
                            <a href="https://djinni.co/jobs/" target="_blank" rel="noopener">
                                {s}
                            </a>
                        ),
                        (s) => (
                            <a href="https://jobs.dou.ua/vacancies/" target="_blank" rel="noopener">
                                {s}
                            </a>
                        ),
                    )}
                </div>
                {custom.length > 0 && <div class="editor">{custom.map(row)}</div>}
                <div class="paste-row">
                    <input
                        type="text"
                        placeholder="https://djinni.co/jobs/?primary_keyword=…"
                        spellcheck={false}
                        value={link}
                        onInput={(e) => setLink(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void add()}
                    />
                    <button disabled={busy || !link.trim()} onClick={() => void add()}>
                        {busy ? t.feedsStep.checking : t.feedsStep.add}
                    </button>
                </div>
                {error && <div class="hint err">{error}</div>}
            </fieldset>
        </>
    )
}

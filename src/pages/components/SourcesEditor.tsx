import { DJINNI_HOST, DOU_HOST, feedName, needsPages, toFeedUrl, unknownDjinniKeywords } from '../../core/feeds'
import type { Source } from '../../core/types'
import { t } from '../../i18n'

/** Hosts covered by host_permissions in public/manifest.json; feeds elsewhere can't be fetched */
const ALLOWED_HOSTS = [DJINNI_HOST, DOU_HOST]

export type SourceRow = Source & { key: number }

interface Props {
    rows: SourceRow[]
    onChange: (rows: SourceRow[]) => void
    newKey: () => number
}

export function sourceProblem(row: SourceRow): string | null {
    if (!row.name.trim()) return t.sources.noName
    let host: string
    try {
        host = new URL(row.url.trim()).hostname
    } catch {
        return t.sources.badUrl
    }
    if (!ALLOWED_HOSTS.includes(host)) return t.sources.onlyHosts(ALLOWED_HOSTS.join(', '))
    return null
}

/** Not blocking: a Djinni category the site may have added since DJINNI_KEYWORDS was taken */
function sourceWarning(row: SourceRow): string | null {
    if (sourceProblem(row)) return null
    const unknown = unknownDjinniKeywords(row.url.trim())
    return unknown.length ? t.sources.unknownDjinni(unknown.map((k) => `«${k}»`).join(', ')) : null
}

export function SourcesEditor({ rows, onChange, newKey }: Props) {
    const update = (key: number, patch: Partial<Source>) =>
        onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    const remove = (key: number) => onChange(rows.filter((r) => r.key !== key))
    const add = () =>
        onChange([...rows, { key: newKey(), id: `src-${Date.now().toString(36)}`, name: '', url: '', enabled: true }])

    return (
        <div class="editor">
            {rows.map((r) => {
                const problem = sourceProblem(r)
                const warning = sourceWarning(r)
                return (
                    <div key={r.key} class={`editor-item${r.enabled ? '' : ' is-off'}`}>
                        <div class="source-row">
                            <input
                                type="checkbox"
                                title={t.sources.enabled}
                                checked={r.enabled}
                                onChange={(e) => update(r.key, { enabled: e.currentTarget.checked })}
                            />
                            <input
                                type="text"
                                class="plain"
                                placeholder={t.sources.namePlaceholder}
                                value={r.name}
                                onInput={(e) => update(r.key, { name: e.currentTarget.value })}
                            />
                            <input
                                type="text"
                                placeholder={t.sources.urlPlaceholder}
                                spellcheck={false}
                                value={r.url}
                                class={`url${problem && r.url ? ' invalid' : ''}`}
                                onInput={(e) => update(r.key, { url: e.currentTarget.value })}
                                onChange={(e) => {
                                    // A pasted search page (djinni.co/jobs/?…, jobs.dou.ua/vacancies/?…) becomes its feed
                                    const url = toFeedUrl(e.currentTarget.value)
                                    if (!url || url === r.url) return
                                    update(r.key, {
                                        url,
                                        ...(!r.name.trim() && { name: feedName(url) }),
                                        ...(needsPages(url) && { fetchPages: true }),
                                    })
                                }}
                            />
                            <label class="inline" title={t.sources.checkPageTitle}>
                                <input
                                    type="checkbox"
                                    checked={!!r.fetchPages}
                                    onChange={(e) => update(r.key, { fetchPages: e.currentTarget.checked })}
                                />{' '}
                                {t.sources.checkPage}
                            </label>
                            <button class="icon" title={t.common.remove} onClick={() => remove(r.key)}>
                                ×
                            </button>
                        </div>
                        {problem && (r.name || r.url) && <div class="hint err">{problem}</div>}
                        {warning && <div class="hint warn">{warning}</div>}
                    </div>
                )
            })}
            <button onClick={add}>{t.sources.add}</button>
        </div>
    )
}

import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { makeBackup, readBackup } from '../core/backup'
import { MAX_AGE_DAYS } from '../core/collect'
import { diagnostics } from '../core/diagnostics'
import { DEFAULT_SETTINGS, MAX_SOURCES, MIN_INTERVAL_HOURS } from '../core/defaults'
import { toFeedUrl } from '../core/feeds'
import type { Rule, Settings } from '../core/types'
import { LOCALES, locale, ruleLabel, t } from '../i18n'
import { getJobs, getLastRun, getSettings, saveSettings } from '../services/storage'
import { ruleProblem, type RuleRow, RulesEditor } from './components/RulesEditor'
import { sourceProblem, type SourceRow, SourcesEditor } from './components/SourcesEditor'
import { applyLocale } from './utils'

let lastKey = 0
const newKey = () => ++lastKey

/** Form state: numbers are kept as raw strings until save, list rows carry a stable key for rendering. */
interface Draft {
    applyThreshold: string
    hideBelow: string
    maxAgeDays: string
    minSalary: string
    techBonusCap: string
    unlistedTitle: string
    unlistedDescription: string
    intervalHours: string
    notify: boolean
    tgEnabled: boolean
    tgToken: string
    tgChat: string
    locale: Settings['locale']
    sources: SourceRow[]
    rules: RuleRow[]
}

const toDraft = (s: Settings): Draft => ({
    applyThreshold: String(s.applyThreshold),
    hideBelow: String(s.hideBelow),
    maxAgeDays: String(s.maxAgeDays),
    minSalary: s.minSalary ? String(s.minSalary) : '',
    techBonusCap: String(s.techBonusCap),
    unlistedTitle: String(s.unlistedTech.title),
    unlistedDescription: String(s.unlistedTech.description),
    intervalHours: String(s.intervalHours),
    notify: s.notify,
    tgEnabled: s.telegram.enabled,
    tgToken: s.telegram.botToken,
    tgChat: s.telegram.chatId,
    locale: s.locale,
    sources: s.sources.map((src) => ({ ...src, key: newKey() })),
    rules: s.rules.map((r) => ({
        key: newKey(),
        label: ruleLabel(r),
        ...(r.labelKey && { labelKey: r.labelKey, shownLabel: ruleLabel(r) }),
        pattern: r.pattern,
        weight: String(r.weight),
        titleOnly: !!r.titleOnly,
        unless: r.unless ?? '',
    })),
})

const toRule = (r: RuleRow): Rule => ({
    pattern: r.pattern.trim(),
    weight: Number(r.weight),
    label: r.label.trim(),
    // A generated label keeps following the interface language until the user renames the rule
    ...(r.labelKey && r.label.trim() === r.shownLabel && { labelKey: r.labelKey }),
    ...(r.titleOnly && { titleOnly: true }),
    ...(r.unless.trim() && { unless: r.unless.trim() }),
})

const rowError = (message: string, tab: Tab) => Object.assign(new Error(message), { tab })

/** Throws with a readable message on the first invalid row instead of saving a rule that silently never matches. */
function fromDraft(d: Draft): Settings {
    d.sources.forEach((s, i) => {
        const problem = sourceProblem(s)
        if (problem) throw rowError(t.options.sourceRow(i + 1, s.name || s.url, problem), 'sources')
    })
    if (d.sources.filter((s) => s.enabled).length > MAX_SOURCES) {
        throw rowError(t.options.tooManySources(MAX_SOURCES), 'sources')
    }
    d.rules.forEach((r, i) => {
        const problem = ruleProblem(r)
        if (problem) throw rowError(t.options.ruleRow(i + 1, r.label || r.pattern, problem), 'filters')
    })
    const sources = d.sources.map(({ key, ...s }) => ({
        ...s,
        name: s.name.trim(),
        url: toFeedUrl(s.url) ?? s.url.trim(),
    }))
    const rules = d.rules.map(toRule)
    return {
        applyThreshold: Number(d.applyThreshold),
        hideBelow: Number(d.hideBelow),
        maxAgeDays: Math.min(MAX_AGE_DAYS, Math.max(1, Number(d.maxAgeDays))),
        minSalary: Math.max(0, Number(d.minSalary) || 0),
        // A penalty: positive input is treated as its negative, empty as 0 (off)
        techBonusCap: Math.max(0, Number(d.techBonusCap) || 0),
        unlistedTech: {
            title: -Math.abs(Number(d.unlistedTitle) || 0),
            description: -Math.abs(Number(d.unlistedDescription) || 0),
        },
        intervalHours: Math.max(MIN_INTERVAL_HOURS, Number(d.intervalHours) || DEFAULT_SETTINGS.intervalHours),
        notify: d.notify,
        telegram: { enabled: d.tgEnabled, botToken: d.tgToken.trim(), chatId: d.tgChat.trim() },
        locale: d.locale,
        sources,
        rules,
    }
}

const errorText = (e: unknown) => t.common.error((e as Error).message)

type Tab = 'general' | 'sources' | 'filters'

const TABS: Tab[] = ['general', 'sources', 'filters']

/** The tab is kept in the URL hash so a reload stays on it */
const initialTab = (): Tab => TABS.find((id) => `#${id}` === location.hash) ?? 'general'

function App() {
    const [draft, setDraft] = useState<Draft>()
    const [tab, setTab] = useState<Tab>(initialTab)
    const [msg, setMsg] = useState('')
    const [tgMsg, setTgMsg] = useState('')
    const [diagMsg, setDiagMsg] = useState('')

    const openTab = (t: Tab) => {
        setTab(t)
        history.replaceState(null, '', `#${t}`)
    }

    // Loaded once: the form shouldn't be overwritten by storage changes while editing
    useEffect(
        () =>
            void getSettings().then((s) => {
                applyLocale(s) // before toDraft: rule labels are shown in the interface language
                document.title = `IT Job Radar — ${t.options.title}`
                setDraft(toDraft(s))
            }),
        [],
    )

    if (!draft) return null

    // Functional update: async handlers (e.g. findChat) must not overwrite edits made while they were waiting
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => d && { ...d, [key]: value })
    const text = (key: keyof Draft) => ({
        value: draft[key] as string,
        onInput: (e: { currentTarget: HTMLInputElement }) => set(key, e.currentTarget.value),
    })
    const check = (key: 'notify' | 'tgEnabled') => ({
        checked: draft[key],
        onChange: (e: { currentTarget: HTMLInputElement }) => set(key, e.currentTarget.checked),
    })

    const save = async (): Promise<boolean> => {
        try {
            await saveSettings(fromDraft(draft))
            await chrome.runtime.sendMessage({ type: 'settings-changed' })
            // Another language: the page and its rule labels are rendered in it from scratch
            const before = locale
            applyLocale({ locale: draft.locale })
            if (locale !== before) location.reload()
            setMsg(t.options.saved)
            return true
        } catch (e) {
            setMsg(errorText(e))
            const errorTab = (e as { tab?: Tab }).tab
            if (errorTab) openTab(errorTab) // the invalid row may be on a tab that isn't open
            return false
        }
    }

    const reset = () => {
        if (confirm(t.options.resetConfirm)) setDraft(toDraft(DEFAULT_SETTINGS))
    }

    const findChat = async () => {
        const token = draft.tgToken.trim()
        if (!token) return setTgMsg(t.options.tgNoToken)
        try {
            const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
            const data = await res.json()
            if (!data.ok) throw new Error(data.description)
            const chat = [...data.result].reverse().find((u: any) => u.message?.chat)?.message.chat
            if (!chat) return setTgMsg(t.options.tgNoChat)
            set('tgChat', String(chat.id))
            setTgMsg(t.options.tgFound(chat.first_name ?? chat.title ?? '', String(chat.id)))
        } catch (e) {
            setTgMsg(errorText(e))
        }
    }

    const testTelegram = async () => {
        if (!(await save())) return
        const r = await chrome.runtime.sendMessage({ type: 'telegram-test' })
        setTgMsg(r?.ok ? t.options.tgSent : t.common.error(r?.error))
    }

    const exportFile = async () => {
        const backup = makeBackup(await getSettings(), await getJobs(), chrome.runtime.getManifest().version)
        const link = document.createElement('a')
        link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' }))
        link.download = `it-job-radar-${backup.exportedAt.slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(link.href)
    }

    const copyDiagnostics = async () => {
        const [savedSettings, jobs, lastRun, alarm] = await Promise.all([
            getSettings(),
            getJobs(),
            getLastRun(),
            chrome.alarms.get('job-radar-refresh'),
        ])
        const text = diagnostics({
            version: chrome.runtime.getManifest().version,
            userAgent: navigator.userAgent,
            browserLanguage: navigator.language,
            settings: savedSettings,
            jobs,
            lastRun,
            alarm: alarm ?? null,
        })
        try {
            await navigator.clipboard.writeText(text)
            setDiagMsg(t.options.copied)
        } catch (e) {
            setDiagMsg(errorText(e))
        }
    }

    const importFile = async (file: File | undefined) => {
        if (!file) return
        const backup = readBackup(await file.text())
        if (!backup) return setMsg(t.common.error(t.options.badBackup))
        if (!confirm(t.options.importConfirm(backup.jobs.length))) return
        await chrome.runtime.sendMessage({ type: 'import', ...backup })
        location.reload() // the draft, and maybe the language, come from the imported settings
    }

    return (
        <div class="wrap">
            <header>
                <h1>{t.options.title}</h1>
                <div class="actions">
                    <span class="hint save-msg">{msg}</span>
                    <a class="btn" href="report.html">
                        {t.options.back}
                    </a>
                    <button class="primary" onClick={save}>
                        {t.common.save}
                    </button>
                </div>
            </header>

            <nav>
                {TABS.map((id) => (
                    <button key={id} aria-pressed={id === tab} onClick={() => openTab(id)}>
                        {t.options.tabs[id]}
                    </button>
                ))}
            </nav>

            {tab === 'general' && (
                <>
                    <fieldset>
                        <legend>{t.options.general}</legend>
                        <div class="row">
                            <div>
                                <label for="threshold">{t.options.applyFrom}</label>
                                <input id="threshold" type="number" min="0" max="100" {...text('applyThreshold')} />
                            </div>
                            <div>
                                <label for="hide">{t.options.hideBelow}</label>
                                <input id="hide" type="number" min="0" max="100" {...text('hideBelow')} />
                            </div>
                            <div>
                                <label for="maxAge">{t.options.maxAge}</label>
                                <input id="maxAge" type="number" min="1" max={MAX_AGE_DAYS} {...text('maxAgeDays')} />
                            </div>
                            <div>
                                <label for="minSalary">{t.options.minSalary}</label>
                                <input
                                    id="minSalary"
                                    type="number"
                                    min="0"
                                    step="100"
                                    placeholder={t.common.notImportant}
                                    {...text('minSalary')}
                                />
                            </div>
                            <div>
                                <label for="interval">{t.options.interval}</label>
                                <input
                                    id="interval"
                                    type="number"
                                    min={MIN_INTERVAL_HOURS}
                                    max="48"
                                    {...text('intervalHours')}
                                />
                            </div>
                            <div>
                                <label for="locale">{t.locale.label}</label>
                                <select
                                    id="locale"
                                    value={draft.locale}
                                    onChange={(e) => set('locale', e.currentTarget.value as Settings['locale'])}
                                >
                                    <option value="auto">{t.locale.auto}</option>
                                    {LOCALES.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div class="hint">{t.options.generalHint}</div>
                        <label>
                            <input type="checkbox" {...check('notify')} /> {t.options.notify}
                        </label>
                    </fieldset>

                    <fieldset>
                        <legend>Telegram</legend>
                        <label>
                            <input type="checkbox" {...check('tgEnabled')} /> {t.options.tgSend}
                        </label>
                        <label for="tgToken">{t.options.tgToken}</label>
                        <input
                            id="tgToken"
                            type="text"
                            autocomplete="off"
                            spellcheck={false}
                            placeholder="123456:ABC…"
                            {...text('tgToken')}
                        />
                        <label for="tgChat">Chat ID</label>
                        <input
                            id="tgChat"
                            type="text"
                            autocomplete="off"
                            placeholder={t.options.tgChatPlaceholder}
                            {...text('tgChat')}
                        />
                        <div class="hint">{t.options.tgHint}</div>
                        <div class="actions" style={{ marginTop: 8 }}>
                            <button onClick={findChat}>{t.options.tgFind}</button>
                            <button onClick={testTelegram}>{t.options.tgTest}</button>
                        </div>
                        <div class="hint">{tgMsg}</div>
                    </fieldset>

                    <fieldset>
                        <legend>{t.options.backup}</legend>
                        <div class="hint">{t.options.backupHint}</div>
                        <div class="actions" style={{ marginTop: 8 }}>
                            <button onClick={() => void exportFile()}>{t.options.exportFile}</button>
                            <label class="btn">
                                {t.options.importFile}
                                <input
                                    type="file"
                                    accept=".json,application/json"
                                    hidden
                                    onChange={(e) => {
                                        void importFile(e.currentTarget.files?.[0])
                                        e.currentTarget.value = '' // the same file can be picked again
                                    }}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend>{t.options.diagnostics}</legend>
                        <div class="hint">{t.options.diagnosticsHint}</div>
                        <div class="actions" style={{ marginTop: 8 }}>
                            <button onClick={() => void copyDiagnostics()}>{t.options.copyDiagnostics}</button>
                            <span class="hint">{diagMsg}</span>
                        </div>
                    </fieldset>
                </>
            )}

            {tab === 'sources' && (
                <fieldset>
                    <legend>{t.options.sourcesTitle}</legend>
                    <div class="hint">
                        {t.options.sourcesHint((s) => (
                            <code>{s}</code>
                        ))}
                    </div>
                    <SourcesEditor rows={draft.sources} onChange={(rows) => set('sources', rows)} newKey={newKey} />
                </fieldset>
            )}

            {tab === 'filters' && (
                <>
                    <fieldset>
                        <legend>{t.options.techs}</legend>
                        <div class="row">
                            <div>
                                <label for="techBonusCap">{t.options.techCap}</label>
                                <input id="techBonusCap" type="number" min="0" {...text('techBonusCap')} />
                            </div>
                            <div>
                                <label for="unlistedTitle">{t.options.unlistedTitle}</label>
                                <input id="unlistedTitle" type="number" max="0" {...text('unlistedTitle')} />
                            </div>
                            <div>
                                <label for="unlistedDescription">{t.options.unlistedDescription}</label>
                                <input
                                    id="unlistedDescription"
                                    type="number"
                                    max="0"
                                    {...text('unlistedDescription')}
                                />
                            </div>
                        </div>
                        <div class="hint">{t.options.techsHint}</div>
                    </fieldset>
                    <fieldset>
                        <legend>{t.options.rules}</legend>
                        <div class="actions" style={{ marginBottom: 8 }}>
                            <a class="btn" href="onboarding.html">
                                {t.options.fromCv}
                            </a>
                        </div>
                        <div class="hint">{t.options.rulesHint}</div>
                        <RulesEditor rows={draft.rules} onChange={(rows) => set('rules', rows)} newKey={newKey} />
                    </fieldset>
                </>
            )}

            <div class="actions">
                <button onClick={reset}>{t.options.reset}</button>
            </div>
        </div>
    )
}

render(<App />, document.getElementById('app')!)

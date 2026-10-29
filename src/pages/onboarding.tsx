import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { analyzeCv, experienceYears } from '../core/cv'
import { MAX_SOURCES } from '../core/defaults'
import { djinniExperience, suggestFeeds, toSources } from '../core/feeds'
import { cvLanguages, type LanguageSkill } from '../core/language'
import { buildRules, type Direction, type Level, type Profile } from '../core/profile'
import { t } from '../i18n'
import { getSettings, saveSettings } from '../services/storage'
import { type Prefs, PrefsStep } from './components/onboarding/PrefsStep'
import { chosenFeeds, type FeedRow, SourcesStep } from './components/onboarding/SourcesStep'
import { type TechRow, TechsStep } from './components/onboarding/TechsStep'
import { UploadStep } from './components/onboarding/UploadStep'
import { useStorage } from './hooks/useStorage'
import { applyLocale, type Platform, PLATFORMS } from './utils'

type Step = 'upload' | 'techs' | 'prefs' | 'sources'

const STEPS: Step[] = ['upload', 'techs', 'prefs', 'sources']

/**
 * Preselected answers: direction from the stack's weights, level from the CV's years (middle without a CV), languages
 * from the CV (none without one: an empty list means every language requirement counts against a job)
 */
function guessPrefs(rows: TechRow[], years: number | null, languages: LanguageSkill[], minSalary: number): Prefs {
    const byDirection = (d: Direction) =>
        rows.filter((r) => r.include && r.tech.category === d).reduce((sum, r) => sum + (Number(r.weight) || 0), 0)
    const direction = (['frontend', 'backend', 'mobile'] as Direction[]).reduce((a, b) =>
        byDirection(b) > byDirection(a) ? b : a,
    )
    const level: Level = years === null ? 'middle' : years >= 5 ? 'senior' : years >= 2 ? 'middle' : 'junior'
    return {
        direction,
        level,
        teamLead: false,
        techLead: false,
        staff: false,
        aiTools: false,
        languages,
        formats: { remote: true, hybrid: false, office: false, relocation: false },
        city: '',
        companyType: 'any',
        fullstackAllowed: null,
        // Re-running the wizard keeps the salary already set
        minSalary: minSalary ? String(minSalary) : '',
    }
}

/**
 * Feeds suggested from the stack, heaviest techs first. The current sources aren't offered: running the wizard again
 * (a backend CV after a frontend one) starts over
 */
function guessFeeds(rows: TechRow[], prefs: Prefs, years: number | null): FeedRow[] {
    const stack = rows
        .filter((r) => r.include && Number(r.weight) > 0)
        .sort((a, b) => Number(b.weight) - Number(a.weight))
        .map((r) => r.tech.id)
    return suggestFeeds(stack, prefs.direction, djinniExperience(prefs.level, years))
}

function App() {
    /** For the interface language only; the wizard reads the settings it changes when it needs them */
    const settings = useStorage(getSettings)
    const [step, setStep] = useState<Step>('upload')
    // Each step starts at its top; «Далі» sits at the bottom of a long page
    useEffect(() => window.scrollTo(0, 0), [step])
    /** No CV: the stack is picked by hand on the next step */
    const [manual, setManual] = useState(false)
    /** Years of experience from the CV, to preselect the level; the CV text itself isn't kept */
    const [years, setYears] = useState<number | null>(null)
    const [languages, setLanguages] = useState<LanguageSkill[]>([])
    const [rows, setRows] = useState<TechRow[]>([])
    const [avoid, setAvoid] = useState<string[]>([])
    const [prefs, setPrefs] = useState<Prefs>()
    const [feeds, setFeeds] = useState<FeedRow[]>()
    /** What the suggested feeds were made for: going back and changing the stack, direction or level makes them again */
    const [feedsFor, setFeedsFor] = useState('')
    const [sites, setSites] = useState<Platform[]>(PLATFORMS.map((p) => p.id))
    const [error, setError] = useState('')

    const start = (found: TechRow[], fromYears: number | null, fromLanguages: LanguageSkill[]) => {
        setLanguages(fromLanguages)
        setManual(!found.length)
        setRows(found)
        setAvoid([])
        setYears(fromYears)
        setPrefs(undefined) // guessed again from the new stack
        setFeeds(undefined)
        setError('')
        setStep('techs')
    }
    const onText = (text: string) => {
        const findings = analyzeCv(text)
        if (!findings.length) return setError(t.wizard.noTechsInCv)
        start(
            findings.map((f) => ({ tech: f.tech, finding: f, weight: String(f.weight), include: true })),
            experienceYears(text),
            cvLanguages(text),
        )
    }
    const toPrefs = async () => {
        if (manual && !rows.some((r) => r.include)) return setError(t.wizard.pickATech)
        setError('')
        if (!prefs) setPrefs(guessPrefs(rows, years, languages, (await getSettings()).minSalary))
        setStep('prefs')
    }

    const toSourcesStep = async () => {
        const bad = rows.find((r) => r.include && !Number.isFinite(Number(r.weight)))
        if (bad) return setError(t.wizard.badWeight(bad.tech.name))
        setError('')
        const madeFor = JSON.stringify([
            prefs!.direction,
            prefs!.level,
            rows.map((r) => [r.tech.id, r.include, r.weight]),
        ])
        if (!feeds || madeFor !== feedsFor) {
            // Pasted feeds and the ticks of feeds suggested again stay
            const fresh = guessFeeds(rows, prefs!, years).map((f) => {
                const old = feeds?.find((o) => !o.custom && o.url === f.url)
                return old ? { ...f, checked: old.checked } : f
            })
            setFeeds([...fresh, ...(feeds ?? []).filter((f) => f.custom)])
            setFeedsFor(madeFor)
        }
        setStep('sources')
    }

    const finish = async () => {
        const chosen = chosenFeeds(feeds!, sites)
        if (!chosen.length) return setError(t.wizard.pickASource)
        if (chosen.length > MAX_SOURCES) return setError(t.wizard.tooManySources(MAX_SOURCES))
        const { minSalary, ...answers } = prefs!
        const profile: Profile = {
            ...answers,
            techs: [
                // Unticked = neutral (weight 0), not "another stack"
                ...rows.map((r) => ({ id: r.tech.id, weight: r.include ? Number(r.weight) : 0 })),
            ],
            unwanted: avoid,
        }
        const settings = await getSettings()
        await saveSettings({
            ...settings,
            rules: buildRules(profile),
            minSalary: Math.max(0, Number(minSalary) || 0),
            sources: toSources(chosen, settings.sources),
        })
        // A fresh start: jobs found for the old profile go, except saved and applied ones
        await chrome.runtime.sendMessage({ type: 'settings-changed', reset: true })
        // Not awaited: the refresh runs in the worker while the options page opens
        void chrome.runtime.sendMessage({ type: 'refresh' })
        location.href = 'options.html#filters'
    }

    if (!settings) return null
    applyLocale(settings)
    document.title = t.wizard.pageTitle

    return (
        <div class="wrap">
            <header>
                <div>
                    <h1>{t.wizard.title}</h1>
                    <div class="status">{t.wizard.intro}</div>
                </div>
            </header>
            <nav class="steps">
                {STEPS.map((id) => (
                    <span key={id} aria-current={id === step ? 'step' : undefined}>
                        {t.wizard.steps[id]}
                    </span>
                ))}
            </nav>

            {step === 'upload' && (
                <UploadStep
                    onText={onText}
                    onManual={() => start([], null, [])}
                    onSkip={() => (location.href = 'report.html')}
                />
            )}
            {step === 'techs' && (
                <TechsStep manual={manual} rows={rows} avoid={avoid} onRows={setRows} onAvoid={setAvoid} />
            )}
            {step === 'prefs' && prefs && <PrefsStep prefs={prefs} onChange={setPrefs} />}
            {step === 'sources' && feeds && (
                <SourcesStep feeds={feeds} onChange={setFeeds} sites={sites} onSites={setSites} />
            )}

            {error && <div class="hint err">{error}</div>}
            {step !== 'upload' && (
                <div class="actions">
                    <button
                        onClick={() => {
                            setError('')
                            setStep(step === 'sources' ? 'prefs' : step === 'prefs' ? 'techs' : 'upload')
                        }}
                    >
                        {t.wizard.back}
                    </button>
                    {step === 'techs' || step === 'prefs' ? (
                        <button class="primary" onClick={step === 'techs' ? toPrefs : toSourcesStep}>
                            {t.wizard.next}
                        </button>
                    ) : (
                        <button class="primary" onClick={finish}>
                            {t.common.save}
                        </button>
                    )}
                    {step === 'sources' && <span class="hint">{t.wizard.replaceNote}</span>}
                </div>
            )}
        </div>
    )
}

render(<App />, document.getElementById('app')!)

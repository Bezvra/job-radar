import { AI_TOOLS_WEIGHT, type CompanyType, type Direction, type Level, type Profile } from '../../../core/profile'
import { LANGUAGE_WEIGHT, LANGUAGES, LEVEL_NAMES } from '../../../core/language'
import { TECHS } from '../../../core/techs'
import { t } from '../../../i18n'

/** Everything in Profile except the technologies, which come from the previous step, plus the salary filter */
export type Prefs = Omit<Profile, 'techs' | 'unwanted'> & {
    /** $/month, '' for no minimum; saved to Settings.minSalary, not turned into a rule */
    minSalary: string
}

interface Props {
    prefs: Prefs
    onChange: (prefs: Prefs) => void
}

const DIRECTIONS: { id: Direction; label: string }[] = [
    { id: 'frontend', label: 'Frontend' },
    { id: 'backend', label: 'Backend' },
    { id: 'mobile', label: 'Mobile' },
]
const LEVELS: { id: Level; label: string }[] = [
    { id: 'junior', label: 'Junior' },
    { id: 'middle', label: 'Middle' },
    { id: 'senior', label: 'Senior' },
]
const COMPANY_TYPES: CompanyType[] = ['product', 'outsource', 'any']

function Radios<T extends string>(props: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <div class="choices">
            {props.options.map((o) => (
                <label key={o.id} class="inline">
                    <input type="radio" checked={props.value === o.id} onChange={() => props.onChange(o.id)} />{' '}
                    {o.label}
                </label>
            ))}
        </div>
    )
}

export function PrefsStep({ prefs, onChange }: Props) {
    const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) => onChange({ ...prefs, [key]: value })
    const setFormat = (key: keyof Prefs['formats'], value: boolean) =>
        set('formats', { ...prefs.formats, [key]: value })
    // The other side of a full stack role: for a frontend developer that's backend (and mobile) tech
    const otherSide = TECHS.filter(
        (x) =>
            (x.category === 'frontend' || x.category === 'backend' || x.category === 'mobile') &&
            x.category !== prefs.direction,
    )
    const setLanguage = (i: number, patch: Partial<Prefs['languages'][number]>) =>
        set(
            'languages',
            prefs.languages.map((l, j) => (j === i ? { ...l, ...patch } : l)),
        )
    const unusedLanguage = LANGUAGES.find((x) => !prefs.languages.some((l) => l.id === x.id))
    const toggleAllowed = (id: string) => {
        const allowed = prefs.fullstackAllowed ?? []
        set('fullstackAllowed', allowed.includes(id) ? allowed.filter((x) => x !== id) : [...allowed, id])
    }

    return (
        <>
            <fieldset>
                <legend>{t.prefs.role}</legend>
                <label>{t.prefs.direction}</label>
                <Radios options={DIRECTIONS} value={prefs.direction} onChange={(v) => set('direction', v)} />
                <label>{t.prefs.level}</label>
                <Radios options={LEVELS} value={prefs.level} onChange={(v) => set('level', v)} />
                <label>{t.prefs.above}</label>
                <div class="choices">
                    <label class="inline">
                        <input
                            type="checkbox"
                            checked={prefs.teamLead}
                            onChange={(e) => set('teamLead', e.currentTarget.checked)}
                        />{' '}
                        Team Lead
                    </label>
                    <label class="inline">
                        <input
                            type="checkbox"
                            checked={prefs.techLead}
                            onChange={(e) => set('techLead', e.currentTarget.checked)}
                        />{' '}
                        Tech Lead
                    </label>
                    <label class="inline">
                        <input
                            type="checkbox"
                            checked={prefs.staff}
                            onChange={(e) => set('staff', e.currentTarget.checked)}
                        />{' '}
                        Staff / Principal
                    </label>
                </div>
                <label class="inline">
                    <input
                        type="checkbox"
                        checked={prefs.aiTools}
                        onChange={(e) => set('aiTools', e.currentTarget.checked)}
                    />{' '}
                    {t.prefs.aiTools}
                </label>
                <div class="hint">{t.prefs.aiHint(AI_TOOLS_WEIGHT)}</div>
            </fieldset>

            <fieldset>
                <legend>{t.prefs.format}</legend>
                <div class="choices">
                    <label class="inline">
                        <input
                            type="checkbox"
                            checked={prefs.formats.remote}
                            onChange={(e) => setFormat('remote', e.currentTarget.checked)}
                        />{' '}
                        {t.prefs.remote}
                    </label>
                    <label class="inline">
                        <input
                            type="checkbox"
                            checked={prefs.formats.hybrid}
                            onChange={(e) => setFormat('hybrid', e.currentTarget.checked)}
                        />{' '}
                        {t.prefs.hybrid}
                    </label>
                    <label class="inline">
                        <input
                            type="checkbox"
                            checked={prefs.formats.office}
                            onChange={(e) => setFormat('office', e.currentTarget.checked)}
                        />{' '}
                        {t.prefs.office}
                    </label>
                    <label class="inline">
                        <input
                            type="checkbox"
                            checked={prefs.formats.relocation}
                            onChange={(e) => setFormat('relocation', e.currentTarget.checked)}
                        />{' '}
                        {t.prefs.relocation}
                    </label>
                </div>
                <div class="hint">{t.prefs.relocationHint}</div>
                {(prefs.formats.hybrid || prefs.formats.office) && (
                    <>
                        <label for="city">{t.prefs.city}</label>
                        <input
                            id="city"
                            type="text"
                            class="plain"
                            placeholder={t.prefs.cityPlaceholder}
                            value={prefs.city}
                            onInput={(e) => set('city', e.currentTarget.value)}
                        />
                        <div class="hint">{t.prefs.cityHint}</div>
                    </>
                )}
            </fieldset>

            <fieldset>
                <legend>{t.prefs.languages}</legend>
                <div class="editor">
                    {prefs.languages.map((l, i) => (
                        <div key={l.id} class="editor-item language-row">
                            <select value={l.id} onChange={(e) => setLanguage(i, { id: e.currentTarget.value })}>
                                {LANGUAGES.filter(
                                    (x) => x.id === l.id || !prefs.languages.some((o) => o.id === x.id),
                                ).map((x) => (
                                    <option key={x.id} value={x.id}>
                                        {t.languages[x.id as keyof typeof t.languages] ?? x.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={l.level}
                                onChange={(e) => setLanguage(i, { level: Number(e.currentTarget.value) })}
                            >
                                {LEVEL_NAMES.map((name, j) => (
                                    <option key={name} value={j + 1}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                            <button
                                title={t.prefs.removeLanguage}
                                onClick={() =>
                                    set(
                                        'languages',
                                        prefs.languages.filter((_, j) => j !== i),
                                    )
                                }
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
                {unusedLanguage && (
                    <button
                        style={{ marginTop: 8 }}
                        onClick={() => set('languages', [...prefs.languages, { id: unusedLanguage.id, level: 3 }])}
                    >
                        {t.prefs.addLanguage}
                    </button>
                )}
                {!prefs.languages.length && <div class="hint">{t.prefs.noLanguages(LANGUAGE_WEIGHT)}</div>}
                <div class="hint">{t.prefs.languagesHint(LANGUAGE_WEIGHT)}</div>
            </fieldset>

            <fieldset>
                <legend>{t.prefs.salary}</legend>
                <label for="minSalary">{t.prefs.minSalary}</label>
                <input
                    id="minSalary"
                    type="number"
                    min="0"
                    step="100"
                    class="plain"
                    placeholder={t.common.notImportant}
                    value={prefs.minSalary}
                    onInput={(e) => set('minSalary', e.currentTarget.value)}
                />
                <div class="hint">{t.prefs.salaryHint}</div>
            </fieldset>

            <fieldset>
                <legend>{t.prefs.company}</legend>
                <Radios
                    options={COMPANY_TYPES.map((id) => ({ id, label: t.prefs.companyTypes[id] }))}
                    value={prefs.companyType}
                    onChange={(v) => set('companyType', v)}
                />
            </fieldset>

            <fieldset>
                <legend>Full stack</legend>
                <Radios
                    options={[
                        { id: 'no', label: t.prefs.fullstackNo },
                        { id: 'yes', label: t.prefs.fullstackYes },
                    ]}
                    value={prefs.fullstackAllowed === null ? 'no' : 'yes'}
                    onChange={(v) => set('fullstackAllowed', v === 'no' ? null : prefs.fullstackAllowed ?? [])}
                />
                {prefs.fullstackAllowed !== null && (
                    <>
                        <div class="hint">{t.prefs.fullstackHint}</div>
                        <div class="chips" style={{ marginTop: 8 }}>
                            {otherSide.map((x) => (
                                <button
                                    key={x.id}
                                    class={`chip-btn ${prefs.fullstackAllowed!.includes(x.id) ? 'pos' : ''}`}
                                    onClick={() => toggleAllowed(x.id)}
                                >
                                    {x.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </fieldset>
        </>
    )
}

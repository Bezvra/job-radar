import type { TechFinding } from '../../../core/cv'
import { DEFAULT_SETTINGS } from '../../../core/defaults'
import { t } from '../../../i18n'
import { UNWANTED_WEIGHT } from '../../../core/profile'
import { CATEGORY_LABELS, TECHS, type Tech } from '../../../core/techs'
import { formatWeight } from '../../utils'

/** A tech in the user's stack: found in the CV (with a finding) or added by hand; weight is a string while editing */
export interface TechRow {
    tech: Tech
    finding?: TechFinding
    weight: string
    /** false: neutral (weight 0), known but neither rewarded nor penalized */
    include: boolean
}

/** Default weight of a hand-added tech: with a CV it's an extra beyond the CV stack, without one it is the stack */
export const ADDED_WEIGHT = { cv: 5, manual: 12 }

interface Props {
    /** No CV: the user builds the stack from the dictionary */
    manual: boolean
    rows: TechRow[]
    avoid: string[]
    onRows: (rows: TechRow[]) => void
    onAvoid: (avoid: string[]) => void
}

function note(f: TechFinding | undefined): string {
    if (!f) return t.techs.added
    if (!f.jobsTotal) return t.techs.noDates
    if (!f.lastUsed) return t.techs.skillsOnly
    return t.techs.lastUsed(f.lastUsed.getUTCFullYear(), f.jobsWith, f.jobsTotal)
}

export function TechsStep({ manual, rows, avoid, onRows, onAvoid }: Props) {
    const added = ADDED_WEIGHT[manual ? 'manual' : 'cv']
    const update = (id: string, patch: Partial<TechRow>) =>
        onRows(rows.map((r) => (r.tech.id === id ? { ...r, ...patch } : r)))
    const state = (id: string) => (rows.some((r) => r.tech.id === id) ? 'want' : avoid.includes(id) ? 'avoid' : 'none')
    // none → want (joins the stack above) → avoid → none
    const cycle = (tech: Tech) => {
        const s = state(tech.id)
        if (s === 'none') onRows([...rows, { tech, weight: String(added), include: true }])
        if (s === 'want') {
            onRows(rows.filter((r) => r.tech.id !== tech.id))
            onAvoid([...avoid, tech.id])
        }
        if (s === 'avoid') onAvoid(avoid.filter((id) => id !== tech.id))
    }

    // Techs found in the CV are edited only above; hand-added ones stay as chips so they can be cycled further
    const fromCv = new Set(rows.filter((r) => r.finding).map((r) => r.tech.id))
    const others = Object.entries(CATEGORY_LABELS)
        .map(([category, label]) => ({
            label,
            techs: TECHS.filter((x) => x.category === category && !fromCv.has(x.id)),
        }))
        .filter((g) => g.techs.length)

    return (
        <>
            <fieldset>
                <legend>{manual ? t.techs.stack : t.techs.found}</legend>
                <div class="hint">{manual ? t.techs.stackHint : t.techs.foundHint}</div>
                <div class="editor">
                    {rows.map(({ tech, finding: f, weight, include }) => (
                        <div key={tech.id} class={`editor-item tech-row${include ? '' : ' is-off'}`}>
                            <input
                                type="checkbox"
                                checked={include}
                                onChange={(e) => update(tech.id, { include: e.currentTarget.checked })}
                            />
                            <div>
                                <strong>{tech.name}</strong> <span class="tag">{CATEGORY_LABELS[tech.category]}</span>
                                <div class="hint">{note(f)}</div>
                            </div>
                            {f ? (
                                <div class="meter" title={t.techs.relevance(f.relevance)}>
                                    <div style={{ width: `${f.relevance}%` }} />
                                    <span>{f.relevance}%</span>
                                </div>
                            ) : (
                                <div />
                            )}
                            <input
                                type="number"
                                class={`weight ${Number(weight) > 0 ? 'pos' : Number(weight) < 0 ? 'neg' : ''}`}
                                title={t.techs.weight}
                                disabled={!include}
                                value={weight}
                                onInput={(e) => update(tech.id, { weight: e.currentTarget.value })}
                            />
                        </div>
                    ))}
                </div>
            </fieldset>

            <fieldset>
                <legend>{manual ? t.techs.all : t.techs.others}</legend>
                <div class="hint">
                    {t.techs.cycleHint(
                        (s) => (
                            <span class="chip pos">
                                {s} {formatWeight(added)}
                            </span>
                        ),
                        (s) => (
                            <span class="chip neg">
                                {s} {formatWeight(UNWANTED_WEIGHT)}
                            </span>
                        ),
                        DEFAULT_SETTINGS.unlistedTech.title,
                        DEFAULT_SETTINGS.unlistedTech.description,
                    )}
                </div>
                {others.map((g) => (
                    <div key={g.label} class="tech-group">
                        <div class="tech-group-label">{g.label}</div>
                        <div class="chips">
                            {g.techs.map((x) => {
                                const s = state(x.id)
                                return (
                                    <button
                                        key={x.id}
                                        class={`chip-btn ${s === 'want' ? 'pos' : s === 'avoid' ? 'neg' : ''}`}
                                        onClick={() => cycle(x)}
                                    >
                                        {x.name}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </fieldset>
        </>
    )
}

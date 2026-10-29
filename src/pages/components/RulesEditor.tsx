import type { Rule } from '../../core/types'
import { t } from '../../i18n'

/** Form row: weight stays a string so "-" can be typed on the way to "-12" */
export interface RuleRow {
    key: number
    label: string
    /** A generated rule's label key, kept on save while `label` still reads `shownLabel` (not renamed) */
    labelKey?: Rule['labelKey']
    shownLabel?: string
    pattern: string
    weight: string
    titleOnly: boolean
    unless: string
}

interface Props {
    rows: RuleRow[]
    onChange: (rows: RuleRow[]) => void
    newKey: () => number
}

export function regexError(source: string): string | null {
    try {
        new RegExp(source, 'i')
        return null
    } catch (e) {
        return (e as Error).message.replace(/^Invalid regular expression: /, '')
    }
}

export function ruleProblem(row: RuleRow): string | null {
    if (!row.label.trim()) return t.rulesEditor.noName
    if (!row.pattern.trim()) return t.rulesEditor.noPattern
    if (!Number.isFinite(Number(row.weight)) || row.weight.trim() === '') return t.rulesEditor.badWeight
    const bad = regexError(row.pattern) ?? (row.unless ? regexError(row.unless) : null)
    return bad && t.rulesEditor.badRegex(bad)
}

export function RulesEditor({ rows, onChange, newKey }: Props) {
    const update = (key: number, patch: Partial<RuleRow>) =>
        onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    const remove = (key: number) => onChange(rows.filter((r) => r.key !== key))
    const add = () =>
        onChange([...rows, { key: newKey(), label: '', pattern: '', weight: '5', titleOnly: false, unless: '' }])

    return (
        <div class="editor">
            {rows.map((r) => {
                const w = Number(r.weight)
                const problem = ruleProblem(r)
                return (
                    <div key={r.key} class="editor-item">
                        <div class="rule-head">
                            <input
                                type="number"
                                class={`weight ${w > 0 ? 'pos' : w < 0 ? 'neg' : ''}`}
                                title={t.rulesEditor.weight}
                                value={r.weight}
                                onInput={(e) => update(r.key, { weight: e.currentTarget.value })}
                            />
                            <input
                                type="text"
                                class="plain"
                                placeholder={t.rulesEditor.namePlaceholder}
                                value={r.label}
                                onInput={(e) => update(r.key, { label: e.currentTarget.value })}
                            />
                            <label class="inline" title={t.rulesEditor.titleOnlyTitle}>
                                <input
                                    type="checkbox"
                                    checked={r.titleOnly}
                                    onChange={(e) => update(r.key, { titleOnly: e.currentTarget.checked })}
                                />{' '}
                                {t.rulesEditor.titleOnly}
                            </label>
                            <button class="icon" title={t.common.remove} onClick={() => remove(r.key)}>
                                ×
                            </button>
                        </div>
                        <div class="rule-body">
                            <input
                                type="text"
                                placeholder={t.rulesEditor.patternPlaceholder}
                                spellcheck={false}
                                value={r.pattern}
                                class={r.pattern && regexError(r.pattern) ? 'invalid' : ''}
                                onInput={(e) => update(r.key, { pattern: e.currentTarget.value })}
                            />
                            <input
                                type="text"
                                placeholder={t.rulesEditor.unlessPlaceholder}
                                spellcheck={false}
                                value={r.unless}
                                class={r.unless && regexError(r.unless) ? 'invalid' : ''}
                                onInput={(e) => update(r.key, { unless: e.currentTarget.value })}
                            />
                        </div>
                        {problem && (r.label || r.pattern) && <div class="hint err">{problem}</div>}
                    </div>
                )
            })}
            <button onClick={add}>{t.rulesEditor.add}</button>
        </div>
    )
}

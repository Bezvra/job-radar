import type { Rule } from '../core/types'
import { en } from './en'
import { uk, type Messages } from './uk'

export type Locale = 'uk' | 'en'
/** Settings.locale: 'auto' follows the browser */
export type LocaleSetting = Locale | 'auto'

export const LOCALES: { id: Locale; name: string }[] = [
    { id: 'uk', name: 'Українська' },
    { id: 'en', name: 'English' },
]

const MESSAGES: Record<Locale, Messages> = { uk, en }

/**
 * The messages of the current language. A live binding: importers see the change after setLocale. Pure (no chrome.*),
 * so core/ uses it for the labels it makes; each page and the worker call setLocale from the settings first
 */
export let t: Messages = uk
export let locale: Locale = 'uk'

export function setLocale(next: Locale): void {
    locale = next
    t = MESSAGES[next]
}

/** Ukrainian for a Ukrainian or Russian browser (the Ukrainian job market), English otherwise */
export function resolveLocale(setting: LocaleSetting | undefined, browserLanguage: string): Locale {
    if (setting === 'uk' || setting === 'en') return setting
    return /^(uk|ru)\b/i.test(browserLanguage) ? 'uk' : 'en'
}

export type RuleLabelId = keyof Messages['rule']

/** A generated rule's label in the current language; a rule without a key (made or renamed by hand) keeps its own */
export function ruleLabel(rule: Pick<Rule, 'label' | 'labelKey'>): string {
    const key = rule.labelKey
    const make = key && (t.rule[key.id as RuleLabelId] as ((...args: string[]) => string) | undefined)
    return make ? make(...(key.args ?? [])) : rule.label
}

/** A label in the current language plus its key, for a generated rule */
export const labelled = (id: RuleLabelId, ...args: string[]): Pick<Rule, 'label' | 'labelKey'> => ({
    label: (t.rule[id] as (...a: string[]) => string)(...args),
    labelKey: { id, ...(args.length && { args }) },
})

import { labelled } from '../i18n'
import type { Rule } from './types'

/**
 * Patterns here become scoring rules, which are compiled with the `i` flag only (no `u`): no `\p{L}`, and `\b` doesn't
 * work next to Cyrillic, so Cyrillic word tails are spelled out as character classes.
 */
const UK = '[а-яіїєґ]*'

export interface Language {
    id: string
    name: string
    pattern: string
}

export const LANGUAGES: Language[] = [
    { id: 'en', name: 'Англійська', pattern: `english|англійськ${UK}|английск${UK}` },
    { id: 'uk', name: 'Українська', pattern: `ukrainian|українськ${UK}|украинск${UK}` },
    { id: 'de', name: 'Німецька', pattern: `german(?!y)|deutsch|німецьк${UK}|немецк${UK}` },
    { id: 'pl', name: 'Польська', pattern: `polish(?!ed)|польськ${UK}|польск${UK}` },
    { id: 'fr', name: 'Французька', pattern: `french|французьк${UK}|французск${UK}` },
    { id: 'es', name: 'Іспанська', pattern: `spanish|іспанськ${UK}|испанск${UK}` },
]

/** CEFR levels 1–6; 0 means the user doesn't speak the language */
export const LEVEL_NAMES = [
    'A1 · Beginner',
    'A2 · Elementary',
    'B1 · Intermediate',
    'B2 · Upper-Intermediate',
    'C1 · Advanced',
    'C2 · Proficient',
]
export const levelCode = (level: number) => LEVEL_NAMES[level - 1]?.slice(0, 2) ?? '—'

const cefr = (code: string) => `(?<![a-z0-9])${code}(?![a-z0-9])`
/** Words for each level, index 0 = A1. "Intermediate" and "середній" exclude the pre-/upper- and нижче/вище forms */
const LEVEL_WORDS = [
    `${cefr('a1')}|beginner|початков${UK}|начальн${UK}`,
    `${cefr('a2')}|elementary|pre-?intermediate|нижче середн${UK}|ниже средн${UK}`,
    `${cefr('[bв]1')}|(?<!pre-?|upper-?|upper )intermediate|(?<!нижче |вище )середн${UK}|(?<!ниже |выше )средн${UK}`,
    `${cefr('[bв]2')}|upper[- ]?intermediate|вище середн${UK}|выше средн${UK}`,
    `${cefr('c1')}|advanced|fluent|fluency|excellent|просунут${UK}|продвинут${UK}|вільн${UK}|свободн${UK}`,
    `${cefr('c2')}|native[- ](level|like)|proficient|рівні носія|уровне носителя`,
]
/** In a CV "Ukrainian — native" is C2; in jobs a bare "native" is too loose ("React Native", "AI-native") */
const CV_NATIVE = `native|рідн${UK}|родн${UK}`

/** A level word and a language name in the same clause, either order: "English: B2+", "upper-intermediate English" */
const GAP = '[^.,;\\n]{0,25}'
const near = (language: string, words: string) => `(${language})${GAP}(${words})|(${words})${GAP}(${language})`

export const LANGUAGE_WEIGHT = -20

export interface LanguageSkill {
    id: string
    level: number
}

/**
 * A rule per language whose required level can be above the user's: "English: C1" for a B2 speaker, or any stated
 * level of a language the user doesn't speak. Other languages the user doesn't speak share one rule; for them a plain
 * mention also counts when it reads like a requirement ("French-speaking", "German required"). A range that includes the
 * user's level ("B2–C1" for a B2 speaker, "B1+ is enough, C1 is a plus") doesn't count.
 */
export function languageRules(skills: LanguageSkill[]): Rule[] {
    const level = (id: string) => skills.find((s) => s.id === id)?.level ?? 0
    const rules: Rule[] = []
    const unknown: Language[] = []
    for (const language of LANGUAGES) {
        const own = level(language.id)
        if (own >= LEVEL_NAMES.length) continue
        if (!own && language.id !== 'en') {
            unknown.push(language)
            continue
        }
        rules.push({
            pattern: near(language.pattern, LEVEL_WORDS.slice(own).join('|')),
            weight: LANGUAGE_WEIGHT,
            ...(own ? labelled('languageAbove', language.id, levelCode(own)) : labelled('languageNone', language.id)),
            ...(own && { unless: near(language.pattern, LEVEL_WORDS.slice(0, own).join('|')) }),
        })
    }
    if (unknown.length) {
        const words = [...LEVEL_WORDS, 'required|speaking|skills|written|spoken|знання|володіння'].join('|')
        rules.push({
            pattern: near(unknown.map((x) => x.pattern).join('|'), words),
            weight: LANGUAGE_WEIGHT,
            ...labelled('otherLanguages', ...unknown.map((x) => x.id)),
        })
    }
    return rules
}

/** Languages with a level stated in the CV ("English — B2", "Fluent English", "Англійська: вище середнього"), highest wins */
export function cvLanguages(text: string): LanguageSkill[] {
    const found: LanguageSkill[] = []
    for (const language of LANGUAGES) {
        let best = 0
        ;[...LEVEL_WORDS.slice(0, -1), `${LEVEL_WORDS.at(-1)}|${CV_NATIVE}`].forEach((words, i) => {
            if (new RegExp(near(language.pattern, words), 'i').test(text)) best = Math.max(best, i + 1)
        })
        if (best) found.push({ id: language.id, level: best })
    }
    return found
}

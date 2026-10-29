import { LANGUAGES, languageRules, type LanguageSkill } from './language'
import { techById, type TechCategory } from './techs'
import { labelled, type RuleLabelId } from '../i18n'
import type { Rule } from './types'

export type Level = 'junior' | 'middle' | 'senior'
export type CompanyType = 'product' | 'outsource' | 'any'
export type Direction = Extract<TechCategory, 'frontend' | 'backend' | 'mobile'>

/** Answers from the onboarding wizard; turned into scoring rules by buildRules */
export interface Profile {
    /** Technologies to reward, with the weight the user confirmed (from the CV or added by hand) */
    techs: { id: string; weight: number }[]
    /** Technologies the user doesn't want to work with */
    unwanted: string[]
    direction: Direction
    level: Level
    teamLead: boolean
    techLead: boolean
    /** Staff / Principal: IC levels above senior, separate from lead roles */
    staff: boolean
    /** Spoken languages with a CEFR level 1–6; jobs asking for more get a penalty (see language.ts) */
    languages: LanguageSkill[]
    /** Wants to work with AI coding tools (Claude Code, Codex, Cursor…): jobs that use them get a bonus */
    aiTools: boolean
    /** relocation: open to moving for the job (relocation offered or required) */
    formats: { remote: boolean; hybrid: boolean; office: boolean; relocation: boolean }
    /** City for office/hybrid, comma-separated spellings allowed: "Одеса, Odesa" */
    city: string
    companyType: CompanyType
    /** null: full stack roles aren't wanted; otherwise tech ids that make a full stack role acceptable */
    fullstackAllowed: string[] | null
}

export const UNWANTED_WEIGHT = -12
export const AI_TOOLS_WEIGHT = 10

const LEVEL_PATTERNS: Record<Level, string> = {
    junior: 'junior|trainee|intern|стажер|джуніор',
    middle: '\\bmiddle\\b|mid[- ]level|мідл',
    senior: 'senior|\\bsr\\.?\\b|старший|сеньйор',
}

/** Weight of a title level for a candidate at a given level: own level rewarded, lower levels penalized */
const LEVEL_WEIGHTS: Record<Level, Record<Level, number>> = {
    junior: { junior: 12, middle: -10, senior: -25 },
    middle: { junior: -25, middle: 12, senior: 0 },
    senior: { junior: -40, middle: -25, senior: 12 },
}

const DIRECTION_PATTERNS: Record<Direction, string> = {
    frontend: 'front[- ]?end|frontend|ui engineer',
    backend: 'back[- ]?end|backend',
    mobile: 'mobile|\\bios\\b|android|react native|flutter',
}

/** Matches a title with none of the level or seniority words */
export const NO_LEVEL_IN_TITLE =
    '^(?![\\s\\S]*(junior|trainee|intern|middle|mid[- ]level|senior|\\bsr\\b|lead|head|principal|staff|architect|chief|стажер|джуніор|мідл|сеньйор|старший|лід))'
/** "5+ years", "7 years", "від 5 років", "6 лет": experience asked for at a senior level */
export const SENIOR_YEARS = '\\b([5-9]|1\\d)\\s*\\+?\\s*(years?|yrs|років|роки|рік|лет|года)'

/**
 * Working with AI coding tools, not building AI products (that's the LLM/AI tech): "Claude Code", "Cursor", "AI-first",
 * "AI-assisted development", "use AI coding agents daily". A bare "Claude" or "AI-powered tools" is usually a product feature
 */
export const AI_TOOLS_PATTERN =
    '\\b(claude[ .]?code|codex|cursor|copilot|windsurf|aider|gemini cli|vibe[- ]coding|ai[- ](first|native|forward)|' +
    'ai[- ](assisted|augmented|driven) (development|coding|engineering|tools?|workflows?)|ai[- ]powered (development|coding|ide)|' +
    'ai (coding|development|dev) (tools?|assistants?|agents?)|' +
    'ai (tools?|assistants?|agents?)( and agents)? (in|for|into|as) (your |our |the |daily |day-to-day |a real part of )*(development|coding|workflow|engineering|work)|' +
    'coding (agents?|assistants?)|agentic (coding|development))\\b'

const DAYS = '\\d\\s*(days?|дн[а-яіїєґ]*)'
const PER_WEEK = '(\\s*(a|per|на|в)\\s+(week|тиждень))?'
/**
 * Remote for part of the week is hybrid: "2 days remote", "remote 2 days a week", "2 дні на тиждень віддалено",
 * "3 days in the office", "partially remote"
 */
const PART_REMOTE =
    `${DAYS}${PER_WEEK}\\s*(remote|віддален|удален|from home|вдома|з дому)|` +
    `(remote|віддален[а-яіїєґ]*|удален[а-яіїєґ]*|wfh|work from home)\\s*${DAYS}|` +
    `${DAYS}${PER_WEEK}\\s*(in|at|from|в|у|з)\\s+(the\\s+)?(office|офіс)|partial(ly)? remote|частково віддален`
/** Remote, unless it's only some days of the week (PART_REMOTE) */
const REMOTE_PATTERN =
    `(?<!(${DAYS}${PER_WEEK}\\s*|partial(ly)?\\s+|частково\\s+))(remote|віддален|удален|дистанційн)` +
    `(?![a-zа-яіїєґ]*\\s*${DAYS})`
/** A whole word, so "Chief Operating Officer" or "official" aren't an office; back-office systems and home office aren't either */
const OFFICE_WORD = '(?<!back[- ]|front[- ]|home[- ])\\boffices?\\b|офіс|офис|on-?site'
const HYBRID_WORD = `hybrid|гібрид|гибрид|${PART_REMOTE}`
const OFFICE_PATTERN = `${OFFICE_WORD}|${HYBRID_WORD}`
/**
 * An office or hybrid bonus counts only where the user lives: the text must name their city too (an office in Kyiv is
 * no plus for someone in Odesa). Rules compile with `i` only, so `[\\s\\S]` spans lines
 */
const inCity = (city: string, pattern: string) => `^(?=[\\s\\S]*(${city}))[\\s\\S]*(${pattern})`

/**
 * Labels generated before rules had a labelKey (Ukrainian only), so older saved rules can follow the interface language
 * too; matched exactly, so a rule the user renamed keeps its name. [regex, key id, …captured args]
 */
const LEGACY_LABELS: [RegExp, RuleLabelId][] = [
    [/^Рівень не вказано \(як Middle\)$/, 'noLevel'],
    [/^AI-інструменти$/, 'aiTools'],
    [/^Гібрид$/, 'hybrid'],
    [/^Гібрид: (.+)$/, 'hybridIn'],
    [/^Офіс$/, 'office'],
    [/^Офіс: (.+)$/, 'officeIn'],
    [/^Лише офіс$/, 'onlyOffice'],
    [/^Місто: (.+)$/, 'city'],
    [/^Офіс\/гібрид не в (?:місті |)(.+?)$/, 'elsewhere'],
    [/^Офіс\/гібрид без віддаленки$/, 'noRemote'],
    [/^Релокація$/, 'relocation'],
    [/^Обов’язкова релокація$/, 'relocationRequired'],
    [/^Продукт\/стартап$/, 'product'],
    [/^Аутсорс\/аутстаф$/, 'outsource'],
    [/^Full stack не з (.+)$/, 'fullstackNotWith'],
]
const LEGACY_LANGUAGES = Object.fromEntries(LANGUAGES.map((l) => [l.name, l.id]))

/** The key of a label generated by an older version, or undefined (a user's own label, or one that has a key) */
function legacyLabelKey(label: string): Rule['labelKey'] {
    for (const [re, id] of LEGACY_LABELS) {
        const m = label.match(re)
        if (m) return { id, ...(m.length > 1 && { args: m.slice(1) }) }
    }
    const above = label.match(/^(\S+) вище ([ABC][12])$/)
    if (above && LEGACY_LANGUAGES[above[1]])
        return { id: 'languageAbove', args: [LEGACY_LANGUAGES[above[1]], above[2]] }
    const none = label.match(/^(\S+) \(не володієш\)$/)
    if (none && LEGACY_LANGUAGES[none[1]]) return { id: 'languageNone', args: [LEGACY_LANGUAGES[none[1]]] }
    const other = label.match(/^Інша мова: (.+)$/)
    const ids = other?.[1].split(', ').map((n) => LEGACY_LANGUAGES[n[0].toUpperCase() + n.slice(1)])
    if (ids?.every(Boolean)) return { id: 'otherLanguages', args: ids }
    return undefined
}

/** Patterns earlier versions generated → their fixed versions; applied to saved rules on update (see upgradeRules) */
const PATTERN_FIXES: Record<string, string> = {
    'office|офіс|офис|on-?site': OFFICE_WORD,
    'office|офіс|офис|hybrid|гібрид|гибрид|on-?site': OFFICE_PATTERN,
}

/**
 * Generated fragments that were changed since → their new versions, replaced inside saved patterns and `unless` (they
 * are combined with a city or other words there). Each new version contains the old one, so it's skipped once applied
 */
const FRAGMENT_FIXES: [string, string][] = [
    ['remote|віддален|удален|дистанційн', REMOTE_PATTERN],
    ['hybrid|гібрид|гибрид', HYBRID_WORD],
]

const fixFragments = (s: string) =>
    FRAGMENT_FIXES.reduce((acc, [old, next]) => (acc.includes(next) ? acc : acc.split(old).join(next)), s)

/**
 * Saved rules brought up to date; null when nothing changed. Generated patterns that were fixed since, labels from
 * before labelKey, and office/hybrid bonuses from before they were tied to the city. Edited patterns and labels stay
 */
export function upgradeRules(rules: Rule[]): Rule[] | null {
    let changed = false
    const keyed = rules.map((r) => {
        // Whole patterns first: their keys hold the old fragments
        const pattern = fixFragments(PATTERN_FIXES[r.pattern] ?? r.pattern)
        const fixed = { ...r, pattern, ...(r.unless && { unless: fixFragments(r.unless) }) }
        const labelKey = r.labelKey ?? legacyLabelKey(r.label)
        if (fixed.pattern !== r.pattern || fixed.unless !== r.unless) changed = true
        if (!labelKey || r.labelKey) return fixed
        changed = true
        return { ...fixed, labelKey }
    })
    // The city comes from the «Місто: …» rule
    const city = keyed.find((r) => r.labelKey?.id === 'city' && r.weight > 0)
    const upgraded = keyed.map((r) => {
        const pattern = r.pattern
        const bonus = r.weight > 0 && (pattern === OFFICE_WORD || pattern === HYBRID_WORD)
        if (bonus && city) {
            changed = true
            const id = pattern === OFFICE_WORD ? 'officeIn' : 'hybridIn'
            return { ...r, pattern: inCity(city.pattern, pattern), ...labelled(id, city.labelKey!.args![0]) }
        }
        if (pattern === r.pattern) return r
        changed = true
        return { ...r, pattern }
    })
    return changed ? upgraded : null
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "Одеса, Odesa" → "одес|odes": dropping the last letter also matches inflected forms (Одесі, Одесу) */
export function cityPattern(city: string): string {
    return city
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
        .map((v) => escapeRegex(v.length >= 5 ? v.slice(0, -1) : v))
        .join('|')
}

export function buildRules(p: Profile): Rule[] {
    const rules: Rule[] = []
    const add = (rule: Rule) => rule.weight !== 0 && rules.push(rule)

    for (const { id, weight } of p.techs) {
        const tech = techById(id)
        // Kept even with weight 0: it marks the tech as known, so it is not penalized as another stack
        if (tech) rules.push({ pattern: tech.pattern, weight, label: tech.name })
    }
    for (const id of p.unwanted) {
        const tech = techById(id)
        if (tech) add({ pattern: tech.pattern, weight: UNWANTED_WEIGHT, label: tech.name })
    }

    add({
        pattern: DIRECTION_PATTERNS[p.direction],
        weight: 10,
        label: p.direction[0].toUpperCase() + p.direction.slice(1),
        titleOnly: true,
    })
    for (const level of ['junior', 'middle', 'senior'] as Level[]) {
        const label = level[0].toUpperCase() + level.slice(1)
        add({ pattern: LEVEL_PATTERNS[level], weight: LEVEL_WEIGHTS[p.level][level], label, titleOnly: true })
    }
    // No level in the title: most such jobs are middle. A senior candidate still keeps them when the description asks
    // for 5+ years, which is how many senior roles without "Senior" in the title read
    add({
        pattern: NO_LEVEL_IN_TITLE,
        weight: LEVEL_WEIGHTS[p.level].middle,
        ...labelled('noLevel'),
        titleOnly: true,
        ...(p.level === 'senior' && { unless: SENIOR_YEARS }),
    })
    add({ pattern: 'team ?lead|тім ?лід|тимлид', weight: p.teamLead ? 8 : -10, label: 'Team Lead', titleOnly: true })
    add({
        pattern:
            'tech(nical)?[- ]?lead|техлід|техлид|\\blead (front|back|full|software|mobile|ios|android|developer|engineer)',
        weight: p.techLead ? 8 : -10,
        label: 'Tech Lead',
        titleOnly: true,
    })
    add({ pattern: '\\bstaff\\b|principal', weight: p.staff ? 8 : -10, label: 'Staff/Principal', titleOnly: true })

    // Only a bonus: a job that doesn't mention AI tools may still allow them
    if (p.aiTools) add({ pattern: AI_TOOLS_PATTERN, weight: AI_TOOLS_WEIGHT, ...labelled('aiTools') })

    add({ pattern: REMOTE_PATTERN, weight: p.formats.remote ? 15 : -10, label: 'Remote' })
    const city = cityPattern(p.city)
    const cityName = p.city.split(',')[0].trim()
    // With a city, office and hybrid are a plus only there (see inCity); elsewhere the -20 rule below decides
    const near = (pattern: string, plain: RuleLabelId, inTheCity: RuleLabelId) =>
        city ? { pattern: inCity(city, pattern), ...labelled(inTheCity, cityName) } : { pattern, ...labelled(plain) }
    add(
        p.formats.hybrid
            ? { ...near(HYBRID_WORD, 'hybrid', 'hybridIn'), weight: 5 }
            : { pattern: HYBRID_WORD, weight: -8, ...labelled('hybrid') },
    )
    // Each format shows up as a rule either way, so the choice is visible on the Filters tab
    if (p.formats.office) {
        add({ ...near(OFFICE_WORD, 'office', 'officeIn'), weight: 5 })
    } else {
        add({
            pattern: 'only office|office only|тільки офіс|лише офіс|тільки в офісі',
            weight: -25,
            ...labelled('onlyOffice'),
        })
    }
    const onSite = p.formats.office || p.formats.hybrid
    if (city && onSite) add({ pattern: city, weight: 8, ...labelled('city', cityName) })
    // Office or hybrid with no remote option and not in the user's city: e.g. "Hybrid, Kyiv" for someone in Odesa
    if (!onSite || city) {
        add({
            pattern: OFFICE_PATTERN,
            weight: -20,
            ...(onSite ? labelled('elsewhere', cityName) : labelled('noRemote')),
            unless: [REMOTE_PATTERN, onSite ? city : ''].filter(Boolean).join('|'),
        })
    }
    if (p.formats.relocation) {
        add({ pattern: 'relocat|релокац|переїзд', weight: 5, ...labelled('relocation') })
    } else {
        add({ pattern: 'relocation required|обов.язков\\w* релокац', weight: -25, ...labelled('relocationRequired') })
    }

    if (p.companyType === 'product') {
        add({
            pattern: 'product company|продуктов|our product|own product|startup|стартап|saas',
            weight: 8,
            ...labelled('product'),
        })
        add({ pattern: 'outsourc|аутсорс|outstaff|аутстаф', weight: -4, ...labelled('outsource') })
    } else if (p.companyType === 'outsource') {
        add({ pattern: 'outsourc|аутсорс|outstaff|аутстаф', weight: 4, ...labelled('outsource') })
    }

    rules.push(...languageRules(p.languages))

    if (p.fullstackAllowed === null) {
        add({ pattern: 'full[- ]?stack', weight: -30, label: 'Full stack', titleOnly: true })
    } else if (p.fullstackAllowed.length) {
        const allowed = p.fullstackAllowed.map(techById).filter((x) => x !== undefined)
        add({
            pattern: 'full[- ]?stack',
            weight: -30,
            ...labelled('fullstackNotWith', allowed.map((x) => x.name).join('/')),
            titleOnly: true,
            unless: allowed.map((x) => x.pattern).join('|'),
        })
    }
    return rules
}

import { TECHS, type Tech } from './techs'
import type { Rule, Settings } from './types'
import { ruleLabel, t } from '../i18n'

const BASE = 20

/** In the description only stack techs from categories outside the user's own count; DevOps/QA/Data tools are usual surroundings */
const STACK_CATEGORIES = new Set(['frontend', 'backend', 'mobile'])
/** Long descriptions list many techs: count at most this many against the job */
const MAX_DESCRIPTION_TECHS = 5

export interface ScoreResult {
    score: number
    reasons: { label: string; weight: number }[]
    /** Dictionary techs the job mentions that didn't change the score: weight-0 rules, tooling outside the penalty */
    neutral: string[]
}

/** Settings that tune scoring beyond the rules; without them (as in tests) the extra checks are off */
export type ScoreOptions = Partial<Pick<Settings, 'unlistedTech' | 'techBonusCap'>>

// Every dictionary pattern is tested against every job, so compiled regexes are reused
const compiled = new Map<string, RegExp | null>()
const compile = (source: string) => {
    if (!compiled.has(source)) {
        try {
            compiled.set(source, new RegExp(source, 'i'))
        } catch {
            compiled.set(source, null) // invalid user regex — skip instead of breaking the whole run
        }
    }
    return compiled.get(source)!
}

/**
 * A rule is about this tech: same pattern, same label, or a pattern matching its name. Title-only rules (level, role)
 * are never tech rules by name match: a broad one like "no level in the title" matches any name.
 */
const targets = (rule: Rule, tech: Tech) =>
    rule.pattern === tech.pattern ||
    rule.label.toLowerCase() === tech.name.toLowerCase() ||
    (!rule.titleOnly && !!compile(rule.pattern)?.test(tech.name))

/**
 * What a rule set says about the tech dictionary. It's the same for every job in a run, so it's cached per rules array.
 * - ruleTechs: the techs each rule targets; a rule with any counts toward the tech cap
 * - unlisted: techs no rule mentions; also not named in an `unless` (e.g. .NET in "full stack unless .NET": the user
 *   considered it). Any weight counts, 0 marks a tech as neutral.
 * - own: the user's own stack, categories with a rewarded tech. Tooling from it (Webpack, SCSS for a frontend dev) is fine
 */
const analysisCache = new WeakMap<Rule[], { ruleTechs: Tech[][]; unlisted: Tech[]; own: Set<string> }>()
function analyzeRules(rules: Rule[]) {
    let cached = analysisCache.get(rules)
    if (!cached) {
        const mentions = (tech: Tech) =>
            rules.filter((r) => targets(r, tech) || (!!r.unless && !!compile(r.unless)?.test(tech.name)))
        cached = {
            ruleTechs: rules.map((r) => TECHS.filter((tech) => targets(r, tech))),
            unlisted: TECHS.filter((tech) => !mentions(tech).length),
            own: new Set(TECHS.filter((tech) => mentions(tech).some((r) => r.weight > 0)).map((tech) => tech.category)),
        }
        analysisCache.set(rules, cached)
    }
    return cached
}

/** Penalty for known techs the job mentions but the user's filters don't: the job is likely built on another stack */
function unlistedPenalty(title: string, description: string, rules: Rule[], weights: Settings['unlistedTech']) {
    const reasons: ScoreResult['reasons'] = []
    const penalized: Tech[] = []
    const { unlisted, own } = analyzeRules(rules)

    for (const tech of unlisted) {
        if (weights.title && compile(tech.pattern)!.test(title)) {
            reasons.push({ label: t.score.notInFilters(tech.name), weight: weights.title })
            penalized.push(tech)
        }
    }
    const inDescription = unlisted.filter(
        (tech) =>
            STACK_CATEGORIES.has(tech.category) &&
            !own.has(tech.category) &&
            !compile(tech.pattern)!.test(title) &&
            compile(tech.pattern)!.test(description),
    )
    if (weights.description && inDescription.length) {
        reasons.push({
            label: t.score.otherStack(inDescription.map((x) => x.name).join(', ')),
            weight: weights.description * Math.min(inDescription.length, MAX_DESCRIPTION_TECHS),
        })
        penalized.push(...inDescription)
    }
    return { reasons, penalized }
}

export function scoreJob(title: string, description: string, rules: Rule[], options: ScoreOptions = {}): ScoreResult {
    const full = `${title}\n${description}`
    const reasons: ScoreResult['reasons'] = []
    const { ruleTechs } = analyzeRules(rules)
    /** Techs already shown through a reason, so they aren't listed as neutral too */
    const scored = new Set<Tech>()
    let techBonus = 0

    rules.forEach((rule, i) => {
        const re = compile(rule.pattern)
        const unless = rule.unless ? compile(rule.unless) : null
        if (!re || (rule.unless && !unless)) return
        // Weight 0 marks a tech as known/neutral: it counts as listed but adds nothing to show
        if (rule.weight && re.test(rule.titleOnly ? title : full) && !unless?.test(full)) {
            reasons.push({ label: ruleLabel(rule), weight: rule.weight })
            ruleTechs[i].forEach((tech) => scored.add(tech))
            if (ruleTechs[i].length && rule.weight > 0) techBonus += rule.weight
        }
    })
    // Many matching techs shouldn't outweigh level, role and format: a junior job using the whole stack isn't a fit
    const cap = options.techBonusCap
    if (cap !== undefined && techBonus > cap) {
        reasons.push({ label: t.score.overCap(cap), weight: cap - techBonus })
    }
    // No rules yet (before the wizard): every tech would count as another stack, so leave scores alone
    if (options.unlistedTech && rules.length) {
        const unlisted = unlistedPenalty(title, description, rules, options.unlistedTech)
        reasons.push(...unlisted.reasons)
        unlisted.penalized.forEach((tech) => scored.add(tech))
    }
    const neutral = TECHS.filter((tech) => !scored.has(tech) && compile(tech.pattern)!.test(full)).map((x) => x.name)

    reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    const total = reasons.reduce((sum, r) => sum + r.weight, BASE)
    return { score: Math.max(0, Math.min(100, total)), reasons, neutral }
}

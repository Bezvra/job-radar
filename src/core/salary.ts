import { t } from '../i18n'

export type Currency = 'USD' | 'EUR' | 'UAH'

export interface Salary {
    min?: number
    max?: number
    currency: Currency
    period: 'hour' | 'month' | 'year'
}

/** Rough rates to compare salaries with the user's minimum in $/month; precise enough to filter, not to quote */
const USD_PER: Record<Currency, number> = { USD: 1, EUR: 1.1, UAH: 1 / 41 }
const HOURS_PER_MONTH = 160

const CUR = String.raw`\$|€|₴|(?<!\p{L})(?:usd|eur|грн|uah|дол\p{L}*)(?!\p{L})`
const NUM = String.raw`\d{1,3}(?:[  ,]\d{3})+(?!\d)|\d+(?:\.\d+)?`
const K = String.raw`(?:k|к)(?!\p{L})`
const SALARY = new RegExp(
    String.raw`(?<prefix>(?<!\p{L})(?:up to|from|starting at|від|до|от)\s+)?` +
        String.raw`(?:(?<cur1>${CUR})\s*)?(?<a>${NUM})\s*(?<ka>${K})?\s*(?:(?<cur2>${CUR})\s*)?` +
        String.raw`(?:(?:[-–—]|to|до)\s*(?:(?<cur3>${CUR})\s*)?(?<b>${NUM})\s*(?<kb>${K})?\s*(?<cur4>${CUR})?)?` +
        String.raw`(?:\s*(?:/|per|a|за|на)\s*(?<period>hour|hr|h|год\p{L}*|month|mo|міс\p{L}*|year|yr|annum|рік)(?!\p{L}))?`,
    'giu',
)
/** Words that make an amount in the middle of a description a salary, not a bonus or a budget */
const SALARY_CONTEXT = /(salary|зарплат|зп|з\/п|rate|ставк|compensation|оклад|винагород|дохід|income|pay)[^\n]{0,40}$/iu
/** DOU's title location (with the salary) becomes this first description line in normalize */
const LOCATION_LINE = 'Локація:'

const currencyOf = (mark: string): Currency =>
    mark === '€' || /eur/i.test(mark) ? 'EUR' : mark === '₴' || /грн|uah/i.test(mark) ? 'UAH' : 'USD'
const periodOf = (word: string | undefined): Salary['period'] =>
    !word ? 'month' : /^(hour|hr|h|год)/i.test(word) ? 'hour' : /^(year|yr|annum|рік)/i.test(word) ? 'year' : 'month'
const toNumber = (n: string, k: string | undefined) => Number(n.replace(/[  ,]/g, '')) * (k ? 1000 : 1)

export const monthlyUsd = (amount: number, s: Salary) =>
    (amount * USD_PER[s.currency] * (s.period === 'hour' ? HOURS_PER_MONTH : 1)) / (s.period === 'year' ? 12 : 1)

/** The first salary-looking amount with a currency: "2500 – 3000$", "$1900–2200", "Up to $20/hour", "від 50 000 грн" */
export function findSalary(title: string, description: string): Salary | null {
    const head = description.trimStart()
    // Where a bare amount with a currency is the salary: Djinni starts the description with it, DOU has it in the title
    const leading = head.startsWith(LOCATION_LINE) ? head.indexOf('\n') >>> 0 : 1
    for (const [text, trustedUntil] of [
        [title, Infinity],
        [head, leading],
    ] as const) {
        for (const m of text.matchAll(SALARY)) {
            const g = m.groups!
            const mark = g.cur1 ?? g.cur2 ?? g.cur3 ?? g.cur4
            if (!mark) continue
            const trusted = m.index! < trustedUntil || !!g.period || SALARY_CONTEXT.test(text.slice(0, m.index))
            if (!trusted) continue
            const a = toNumber(g.a, g.ka)
            const b = g.b ? toNumber(g.b, g.kb ?? g.ka) : undefined
            const prefix = g.prefix?.trim().toLowerCase()
            const s: Salary = { currency: currencyOf(mark), period: periodOf(g.period) }
            if (b !== undefined) Object.assign(s, { min: a, max: b })
            else if (prefix === 'up to' || prefix === 'до') s.max = a
            else if (prefix) s.min = a
            else Object.assign(s, { min: a, max: a })
            // Out of range for a salary: a year ("2026 $"), a funding round, a per-task fee
            const usd = monthlyUsd(s.max ?? s.min!, s)
            if (usd >= 300 && usd <= 50_000) return s
        }
    }
    return null
}

/** "$2500–3000", "до $20/год", "від 50 000 грн" (in the current language: "up to $20/h", "from 50 000 UAH") */
export function formatSalary(s: Salary): string {
    const [before, after] = { USD: ['$', ''], EUR: ['€', ''], UAH: ['', t.salary.uah] }[s.currency]
    const period = { hour: t.salary.perHour, month: '', year: t.salary.perYear }[s.period]
    // Group thousands only in big numbers: "$2500", "60 000 грн"
    const n = (v: number) => (v >= 10_000 ? String(v).replace(/\B(?=(\d{3})+$)/g, ' ') : String(v))
    const amount =
        s.min !== undefined && s.max !== undefined
            ? s.min === s.max
                ? n(s.min)
                : `${n(s.min)}–${n(s.max)}`
            : s.max !== undefined
              ? n(s.max)
              : n(s.min!)
    const prefix = s.min === undefined ? t.salary.upTo : s.max === undefined ? t.salary.from : ''
    return `${prefix}${before}${amount}${after}${period}`
}

/**
 * The job pays less than the user's minimum ($/month). Only a known upper bound counts: no salary, or "from X",
 * might still fit, so such jobs stay.
 */
export function belowMinSalary(salary: Salary | null | undefined, minSalary: number): boolean {
    return !!minSalary && salary?.max !== undefined && monthlyUsd(salary.max, salary) < minSalary
}

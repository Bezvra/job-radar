import { TECHS, type Tech } from './techs'

/** A part of the CV: one job/project with its date range, or undated text (summary, skills, education). */
export interface CvBlock {
    start: Date | null
    end: Date | null
    text: string
}

export interface TechFinding {
    tech: Tech
    /** 0–100: 60% recency (how close the last job using it is to the latest job) + 40% frequency (share of jobs using it) */
    relevance: number
    /** Suggested scoring weight, derived from relevance; the user can change it */
    weight: number
    /** End of the most recent job that mentions it; null if it's only in undated text (e.g. a skills list) */
    lastUsed: Date | null
    jobsWith: number
    jobsTotal: number
}

const MONTHS: Record<string, number> = {}
const monthNames = [
    ['jan', 'січ', 'янв'],
    ['feb', 'лют', 'фев'],
    ['mar', 'бер', 'мар'],
    ['apr', 'кві', 'апр'],
    ['may', 'тра', 'мая', 'май'],
    ['jun', 'чер', 'июн'],
    ['jul', 'лип', 'июл'],
    ['aug', 'сер', 'авг'],
    ['sep', 'вер', 'сен'],
    ['oct', 'жов', 'окт'],
    ['nov', 'лис', 'ноя'],
    ['dec', 'гру', 'дек'],
]
monthNames.forEach((names, i) => names.forEach((n) => (MONTHS[n] = i)))

const YEAR = '(?:19|20)\\d\\d'
// "Mar 2021", "березень 2021", "03/2021", "03.2021", "2021"
const DATE = `(?:[a-zа-яіїєґ]{3,}\\.?\\s+${YEAR}|\\d{1,2}[./]${YEAR}|${YEAR})`
const PRESENT =
    'present|now|current(?:ly)?|today|till now|теперішній час|дотепер|донині|нині|сьогодні|зараз|настоящее время|наст\\. вр\\.|сейчас'
const RANGE = new RegExp(`(${DATE})\\s*(?:[-–—]+|to|по|до)\\s*(${DATE}|${PRESENT})`, 'gi')
// Section titles that end a job block: what follows isn't part of the previous job
// Section titles that end a job block: a short line without digits or text after a colon, naming a section.
// Loose on purpose: "CORE SKILLS", "Education and Certification", "Технічні навички:"
const HEADING =
    /^[ \t]*[^\n\d:]{0,30}?(?<!\p{L})(skills|education|languages|certificat\p{L}*|courses|hobbies|interests|technologies|tech stack|навички|технології|освіта|мови|курси|сертифікат\p{L}*|навыки|образование|языки)(?!\p{L})[^\n\d:]{0,30}:?[ \t]*$/gimu

function parseDate(s: string, now: Date): Date | null {
    const v = s.trim().toLowerCase()
    if (new RegExp(`^(${PRESENT})$`, 'i').test(v)) return now
    const year = Number(v.match(new RegExp(YEAR))?.[0])
    if (!year) return null
    const numeric = v.match(/^(\d{1,2})[./]/)
    // An unknown word before the year ("since 2019") or a bare year: count from January
    const month = numeric ? Number(numeric[1]) - 1 : MONTHS[v.slice(0, 3)] ?? 0
    if (month < 0 || month > 11) return null
    return new Date(Date.UTC(year, month, 1))
}

/** Splits CV text into blocks at each date range (a job/project) and at section headings (skills, education…). */
export function splitCv(text: string, now = new Date()): CvBlock[] {
    const cuts: { at: number; start: Date | null; end: Date | null }[] = []
    for (const m of text.matchAll(RANGE)) {
        const start = parseDate(m[1], now)
        const end = parseDate(m[2], now)
        if (start && end && end >= start) cuts.push({ at: m.index!, start, end })
    }
    for (const m of text.matchAll(HEADING)) cuts.push({ at: m.index!, start: null, end: null })
    cuts.sort((a, b) => a.at - b.at)

    const blocks: CvBlock[] = [{ start: null, end: null, text: text.slice(0, cuts[0]?.at ?? text.length) }]
    cuts.forEach((c, i) => blocks.push({ start: c.start, end: c.end, text: text.slice(c.at, cuts[i + 1]?.at) }))
    return blocks.filter((b) => b.text.trim())
}

const YEAR_MS = 365.25 * 86_400_000

/** CV text is matched with cvPattern when a tech has one (case-sensitive, e.g. "Go"), else with its rule pattern */
const cvRegex = (tech: Tech, flags = '') =>
    tech.cvPattern ? new RegExp(tech.cvPattern, flags) : new RegExp(tech.pattern, `i${flags}`)
const matches = (tech: Tech, s: string) => cvRegex(tech).test(s)

/** Dated blocks that mention some technology count as jobs; education and other ranges are skipped */
const jobBlocks = (text: string, now: Date) =>
    splitCv(text, now).filter((b) => b.end && TECHS.some((tech) => matches(tech, b.text)))

/** Years from the start of the earliest job to now: a hint for preselecting the level, not a precise measure */
export function experienceYears(text: string, now = new Date()): number {
    const starts = jobBlocks(text, now).map((b) => b.start!.getTime())
    return starts.length ? (now.getTime() - Math.min(...starts)) / YEAR_MS : 0
}

/** Proportional to relevance, 1–20: 20 is the weight of a core skill in the built-in rules */
/** Relevance factor for a tech the CV names only once */
const SINGLE_MENTION = 0.5

export const suggestWeight = (relevance: number) => Math.max(1, Math.round(relevance / 5))

/** Finds known technologies in a CV and rates how relevant each one is for the candidate today. */
export function analyzeCv(text: string, now = new Date()): TechFinding[] {
    // Newest job first: recency is the job's position, not years, so a long current job doesn't age the previous one
    const jobs = jobBlocks(text, now).sort((a, b) => b.end!.getTime() - a.end!.getTime())

    const findings: TechFinding[] = []
    for (const tech of TECHS) {
        if (!matches(tech, text)) continue
        const usedIn = jobs.filter((b) => matches(tech, b.text))
        const lastUsed = usedIn.length ? new Date(Math.max(...usedIn.map((b) => b.end!.getTime()))) : null

        let recency: number
        let frequency: number
        if (!jobs.length) {
            // No dates found: all we know is that the tech is mentioned, more mentions = more weight
            recency = 0.5
            frequency = Math.min(1, (text.match(cvRegex(tech, 'g'))?.length ?? 0) / 5)
        } else if (lastUsed) {
            // Latest job 1, the one before (n-1)/n, …, the oldest 1/n
            recency = 1 - jobs.indexOf(usedIn.reduce((a, b) => (b.end! > a.end! ? b : a))) / jobs.length
            frequency = usedIn.length / jobs.length
        } else {
            // Only in a skills list or summary: claimed, but not tied to any job
            recency = 0.4
            frequency = 0
        }
        // Named once in the whole CV ("also touched Kafka" in the latest job): a side tool rather than the stack
        const once = (text.match(cvRegex(tech, 'g'))?.length ?? 0) <= 1
        const relevance = Math.round(100 * (0.6 * recency + 0.4 * frequency) * (once ? SINGLE_MENTION : 1))
        findings.push({
            tech,
            relevance,
            weight: suggestWeight(relevance),
            lastUsed,
            jobsWith: usedIn.length,
            jobsTotal: jobs.length,
        })
    }
    return findings.sort((a, b) => b.relevance - a.relevance)
}

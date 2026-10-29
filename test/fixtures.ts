import { NO_LEVEL_IN_TITLE, SENIOR_YEARS } from '../src/core/profile'
import type { Rule, Settings } from '../src/core/types'
import { DEFAULT_SETTINGS } from '../src/core/defaults'

// The old built-in rules (Senior Frontend React/TS, remote or Odesa): a fixed profile for the scoring tests
export const RULES: Rule[] = [
    // Stack
    { pattern: '\\breact\\b', weight: 20, label: 'React' },
    { pattern: 'typescript|\\bts\\b', weight: 12, label: 'TypeScript' },
    { pattern: 'next\\.?js', weight: 6, label: 'Next.js' },
    { pattern: 'redux', weight: 5, label: 'Redux' },
    { pattern: 'graphql|apollo', weight: 5, label: 'GraphQL' },
    { pattern: 'websocket|real[- ]?time', weight: 5, label: 'WebSocket/realtime' },
    { pattern: 'pwa|web ?workers?|webassembly|wasm', weight: 3, label: 'PWA/Workers/WASM' },
    // Role & level
    { pattern: 'front[- ]?end|frontend|ui engineer', weight: 10, label: 'Frontend', titleOnly: true },
    { pattern: 'senior|sr\\.?\\b|старший', weight: 12, label: 'Senior', titleOnly: true },
    { pattern: 'lead|tech lead|team lead|staff|principal', weight: 8, label: 'Lead/Staff', titleOnly: true },
    { pattern: 'junior|trainee|intern|стажер', weight: -40, label: 'Junior', titleOnly: true },
    { pattern: '\\bmiddle\\b|mid[- ]level', weight: -25, label: 'Middle', titleOnly: true },
    {
        pattern: NO_LEVEL_IN_TITLE,
        weight: -25,
        label: 'Рівень не вказано (як Middle)',
        titleOnly: true,
        unless: SENIOR_YEARS,
    },
    {
        pattern: 'full[- ]?stack',
        weight: -30,
        label: 'Full stack не на .NET',
        titleOnly: true,
        unless: '(?<![\\w.])\\.net\\b|\\basp\\.net|\\bdotnet\\b|\\bc#',
    },
    // Format & location
    { pattern: 'remote|віддалено|удаленно|дистанційно', weight: 15, label: 'Remote' },
    { pattern: 'одес|odes', weight: 8, label: 'Одеса' },
    {
        pattern: 'office|офіс|офис|hybrid|гібрид|гибрид|on-?site',
        weight: -20,
        label: 'Офіс/гібрид не в Одесі',
        unless: 'remote|віддален|удален|дистанційн|одес|odes',
    },
    {
        pattern: 'relocation required|обов.язков\\w* релокац|only office|тільки офіс',
        weight: -25,
        label: 'Релокація/лише офіс',
    },
    // Company type
    {
        pattern: 'product company|продуктов|our product|own product|startup|стартап|saas',
        weight: 8,
        label: 'Продукт/стартап',
    },
    { pattern: 'outsourc|аутсорс|outstaff|аутстаф', weight: -4, label: 'Аутсорс/аутстаф' },
    // Off-stack
    { pattern: '\\bangular\\b', weight: -10, label: 'Angular' },
    { pattern: '\\bvue\\b', weight: -8, label: 'Vue' },
    // Neutral: known and fine, so not penalized as another stack
    { pattern: '\\bjavascript\\b', weight: 0, label: 'JavaScript' },
    { pattern: '\\bphp\\b|laravel|wordpress', weight: -12, label: 'PHP/WordPress' },
    { pattern: 'react native', weight: -6, label: 'React Native' },
]
/** The sources the extension used to ship with; now the wizard picks them */
export const SOURCES: Settings['sources'] = [
    {
        id: 'djinni-react',
        name: 'Djinni · React',
        url: 'https://djinni.co/jobs/rss/?all_keywords=react',
        enabled: true,
        fetchPages: true,
    },
    {
        id: 'djinni-js',
        name: 'Djinni · JavaScript',
        url: 'https://djinni.co/jobs/rss/?primary_keyword=JavaScript',
        enabled: true,
        fetchPages: true,
    },
    {
        id: 'dou-frontend',
        name: 'DOU · Front End',
        url: 'https://jobs.dou.ua/vacancies/feeds/?category=Front%20End',
        enabled: true,
    },
    {
        id: 'dou-react',
        name: 'DOU · пошук «React»',
        url: 'https://jobs.dou.ua/vacancies/feeds/?search=React',
        enabled: true,
    },
]
export const SETTINGS: Settings = { ...DEFAULT_SETTINGS, sources: SOURCES, rules: RULES }

export const DJINNI = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Djinni</title>
<item><title>Senior React Developer</title><link>https://djinni.co/jobs/812345-senior-react-developer/?utm_source=rss</link>
<description><![CDATA[<p>We are a <b>product company</b> building a SaaS platform.</p><ul><li>5+ years with React, TypeScript</li><li>Redux, GraphQL</li></ul><p>Remote, Ukraine &amp; EU</p>]]></description>
<pubDate>Mon, 26 Oct 2026 10:00:00 +0000</pubDate><dc:creator>Acme Labs</dc:creator><category>React</category></item>
<item><title>Junior Angular Developer</title><link>https://djinni.co/jobs/812346-junior-angular/</link>
<description>Angular, office in Kyiv only office</description><pubDate>Mon, 26 Oct 2026 11:00:00 +0000</pubDate></item>
</channel></rss>`

export const DOU = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel>
<item><title>Senior Front-end Developer в Acme Labs, віддалено</title><link>https://jobs.dou.ua/companies/acme/vacancies/330001/?utm_source=jobsrss</link>
<description>&lt;p&gt;React, TypeScript, Next.js&lt;/p&gt;</description><pubDate>Mon, 26 Oct 2026 09:00:00 +0300</pubDate></item>
<item><title>Full Stack Engineer (PHP/Vue) в Outsource Co, Київ</title><link>https://jobs.dou.ua/companies/out/vacancies/330002/</link>
<description>Laravel, Vue, outsourcing projects</description><pubDate>Mon, 26 Oct 2026 08:00:00 +0300</pubDate></item>
</channel></rss>`

export const CV = `Alex K.
Senior Frontend Engineer. React, TypeScript, Node.js.

Experience
Acme Labs — Senior Frontend Engineer
Mar 2022 – Present
Built a trading UI with React, TypeScript, Redux and WebSocket. Some Node.js services.

Beta Soft
03.2019 - 02.2022
React, TypeScript, GraphQL. Migrated legacy jQuery pages.

Gamma Outsourcing
2016 — 2019
Angular, jQuery, PHP (Laravel) backend.

EDUCATION AND CERTIFICATION
State Technical University, 2010 - 2015

CORE SKILLS
React, TypeScript, Docker, Vue`

export const NOW = new Date('2026-10-27T00:00:00Z')

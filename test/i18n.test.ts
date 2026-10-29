import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { buildRules, type Profile, upgradeRules } from '../src/core/profile'
import { formatSalary } from '../src/core/salary'
import { scoreJob } from '../src/core/scoring'
import { DEFAULT_SETTINGS } from '../src/core/defaults'
import { resolveLocale, ruleLabel, setLocale } from '../src/i18n'
import { en } from '../src/i18n/en'
import { uk } from '../src/i18n/uk'

afterEach(() => setLocale('uk'))

const profile: Profile = {
    techs: [{ id: 'react', weight: 20 }],
    unwanted: [],
    direction: 'frontend',
    level: 'senior',
    teamLead: false,
    techLead: false,
    staff: false,
    aiTools: true,
    languages: [{ id: 'en', level: 4 }],
    formats: { remote: true, hybrid: true, office: true, relocation: false },
    city: 'Одеса',
    companyType: 'product',
    fullstackAllowed: null,
}

/** Every text in a dictionary, each function called with sample arguments: wrappers (for messages with markup) or values */
function texts(messages: unknown): string[] {
    if (typeof messages === 'string') return [messages]
    if (typeof messages === 'function') {
        const wrap = (s: string) => s
        try {
            return texts(messages(wrap, wrap, 3, 4))
        } catch {
            return texts(messages('Odesa', 'B2', '3', '4'))
        }
    }
    if (Array.isArray(messages)) return messages.flatMap(texts)
    if (messages && typeof messages === 'object') return Object.values(messages).flatMap(texts)
    return []
}

test('i18n: the English messages are complete and have no Ukrainian left', () => {
    const english = texts(en)
    // A city in its own script (from a rule's arguments) is fine; nothing else Cyrillic
    const cyrillic = english.filter((s) => /[А-Яа-яІіЇїЄєҐґ]/.test(s.replace(/Одеса/g, '')))
    assert.deepEqual(cyrillic, [])
    assert.equal(english.length, texts(uk).length, 'the same messages in both')
    assert.ok(english.length > 150)
})

test('i18n: generated rule labels and score reasons follow the interface language', () => {
    const rules = buildRules(profile)
    const labels = () => rules.map(ruleLabel)
    assert.ok(labels().includes('Офіс: Одеса') && labels().includes('Англійська вище B2'))
    setLocale('en')
    assert.ok(labels().includes('Office: Одеса') && labels().includes('English above B2'), labels().join(' | '))
    assert.ok(labels().includes('React'), 'tech rules are named after the tech, in any language')

    const reasons = scoreJob(
        'Junior Java Developer',
        'Office in Kyiv. Upper-intermediate English',
        rules,
        DEFAULT_SETTINGS,
    )
    const shown = reasons.reasons.map((r) => r.label)
    assert.ok(shown.includes('No level stated (as Middle)') || shown.includes('Junior'), shown.join(' | '))
    assert.ok(
        shown.some((l) => l.startsWith('Java isn’t in your filters')),
        shown.join(' | '),
    )
    assert.equal(formatSalary({ currency: 'UAH', period: 'month', min: 60000 }), 'from 60 000 UAH')
})

test('i18n: rules saved before label keys get them; renamed rules keep their own label', () => {
    const old = [
        { pattern: 'одес|odes', weight: 8, label: 'Місто: Одеса' },
        { pattern: 'x', weight: -25, label: 'Рівень не вказано (як Middle)' },
        { pattern: 'y', weight: -20, label: 'Англійська вище B2' },
        { pattern: 'z', weight: -20, label: 'Інша мова: німецька, польська' },
        { pattern: 'w', weight: -20, label: 'Офіс/гібрид не в місті Одеса' },
        { pattern: 'v', weight: 5, label: 'Мій офіс' },
    ]
    const upgraded = upgradeRules(old)!
    assert.deepEqual(
        upgraded.map((r) => r.labelKey),
        [
            { id: 'city', args: ['Одеса'] },
            { id: 'noLevel' },
            { id: 'languageAbove', args: ['en', 'B2'] },
            { id: 'otherLanguages', args: ['de', 'pl'] },
            { id: 'elsewhere', args: ['Одеса'] },
            undefined,
        ],
    )
    setLocale('en')
    assert.deepEqual(upgraded.map(ruleLabel), [
        'City: Одеса',
        'No level stated (as Middle)',
        'English above B2',
        'Other language: German, Polish',
        'Office/hybrid outside Одеса',
        'Мій офіс',
    ])
    assert.equal(upgradeRules(upgraded), null, 'nothing left to upgrade')
})

test('i18n: auto picks Ukrainian for a Ukrainian or Russian browser, English otherwise', () => {
    assert.equal(resolveLocale('auto', 'uk-UA'), 'uk')
    assert.equal(resolveLocale('auto', 'ru'), 'uk')
    assert.equal(resolveLocale('auto', 'en-US'), 'en')
    assert.equal(resolveLocale('auto', 'pl-PL'), 'en')
    assert.equal(resolveLocale('en', 'uk-UA'), 'en')
    assert.equal(resolveLocale(undefined, 'de'), 'en')
})

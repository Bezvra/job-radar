import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRules, cityPattern, type Profile, UNWANTED_WEIGHT, upgradeRules } from '../src/core/profile'
import { scoreJob } from '../src/core/scoring'
import { RULES } from './fixtures'

test('profile turns into rules: level, leads, formats, full stack', () => {
    const rules = buildRules({
        techs: [{ id: 'react', weight: 20 }],
        unwanted: ['angular'],
        direction: 'frontend',
        level: 'senior',
        teamLead: false,
        techLead: true,
        staff: false,
        aiTools: false,
        languages: [],
        formats: { remote: true, hybrid: true, office: false, relocation: false },
        city: 'Одеса, Odesa',
        companyType: 'product',
        fullstackAllowed: ['dotnet'],
    })
    const score = (title: string, desc = '') => scoreJob(title, desc, rules).score
    assert.ok(score('Senior React Developer', 'remote') > score('Junior React Developer', 'remote'))
    assert.ok(score('Tech Lead Frontend', 'React') > score('Team Lead Frontend', 'React'))
    assert.ok(
        score('Senior Full Stack (React + .NET)', 'remote') > score('Senior Full Stack (React + Python)', 'remote'),
    )
    assert.ok(rules.some((r) => r.label === 'Angular' && r.weight === UNWANTED_WEIGHT))
    assert.equal(cityPattern('Одеса, Odesa'), 'одес|odes')
    assert.ok(score('Frontend', 'гібрид, офіс в Одесі') > score('Frontend', 'гібрид, офіс у Львові'))
    assert.ok(
        rules.some((r) => r.label === 'Лише офіс'),
        'office not selected',
    )
    assert.ok(score('Frontend', 'relocation required to Berlin') < score('Frontend', 'Berlin'), 'relocation not wanted')
    const relocate = buildRules({
        techs: [],
        unwanted: [],
        direction: 'frontend',
        level: 'senior',
        teamLead: false,
        techLead: false,
        staff: false,
        aiTools: false,
        languages: [],
        formats: { remote: false, hybrid: false, office: true, relocation: true },
        city: '',
        companyType: 'any',
        fullstackAllowed: [],
    })
    assert.ok(
        scoreJob('Frontend', 'relocation package to Berlin', relocate).score >
            scoreJob('Frontend', 'Berlin', relocate).score,
        'relocation wanted',
    )
    assert.ok(
        relocate.some((r) => r.label === 'Офіс' && r.weight > 0),
        'office shows up as a rule even without a city',
    )
    assert.ok(!relocate.some((r) => r.label === 'Лише офіс'))
})

test('office or hybrid elsewhere is penalized; Staff/Principal is its own choice', () => {
    const profile = {
        techs: [{ id: 'react', weight: 20 }],
        unwanted: [],
        direction: 'frontend' as const,
        level: 'senior' as const,
        teamLead: false,
        techLead: true,
        staff: false,
        aiTools: false,
        languages: [],
        formats: { remote: true, hybrid: true, office: false, relocation: false },
        city: 'Одеса, Odesa',
        companyType: 'any' as const,
        fullstackAllowed: null,
    }
    const rules = buildRules(profile)
    const score = (title: string, desc: string) => scoreJob(title, desc, rules).score
    assert.ok(
        score('Senior React Developer', 'Hybrid, Kyiv office') <
            score('Senior React Developer', 'Hybrid, Odesa office') - 20,
    )
    assert.equal(
        score('Senior React Developer', 'Remote or office in Kyiv'),
        score('Senior React Developer', 'Remote or office in Lviv'),
        'a remote option means the city does not matter',
    )
    assert.ok(score('Principal Frontend Engineer', 'React') < score('Tech Lead Frontend', 'React'), 'staff not chosen')
    assert.ok(
        scoreJob('Principal Frontend Engineer', 'React', buildRules({ ...profile, staff: true })).score >
            score('Principal Frontend Engineer', 'React'),
    )
})

test('a title without a level counts as middle unless 5+ years are required', () => {
    const rules = RULES
    const has = (title: string, desc = '') =>
        scoreJob(title, desc, rules).reasons.some((r) => r.label === 'Рівень не вказано (як Middle)')
    assert.ok(has('Frontend Developer', 'React, 3+ years'))
    assert.ok(!has('Frontend Developer', 'React, 5+ years of experience') && !has('Front-end розробник', 'від 6 років'))
    assert.ok(!has('Senior Frontend Developer') && !has('Tech Lead React') && !has('Principal Engineer'))
    assert.ok(!has('Middle Frontend Developer'), 'an explicit level is handled by its own rule')
    // Broad title-only rules must not mark every tech as "listed"
    const unlisted = scoreJob('Java Developer', '', rules, { unlistedTech: { title: -15, description: -8 } })
    assert.ok(unlisted.reasons.some((r) => r.label === 'Java — не у фільтрах'))
})

test('AI coding tools: a bonus only when the user wants them, not for building AI products', () => {
    const profile: Profile = {
        techs: [{ id: 'react', weight: 15 }],
        unwanted: [],
        direction: 'frontend',
        level: 'senior',
        teamLead: false,
        techLead: false,
        staff: false,
        aiTools: true,
        languages: [],
        formats: { remote: true, hybrid: false, office: false, relocation: false },
        city: '',
        companyType: 'any',
        fullstackAllowed: null,
    }
    const has = (desc: string, p = profile) =>
        scoreJob('Senior React Developer', desc, buildRules(p)).reasons.some((r) => r.label === 'AI-інструменти')
    assert.ok(has('We use Claude Code and Cursor every day'))
    assert.ok(has('AI-first team. React, TypeScript'))
    assert.ok(has('Experience with AI-assisted development tools'))
    assert.ok(has('Use AI coding tools and agents in your daily workflow'))
    assert.ok(!has('Integrate LLMs (OpenAI API, Gemini, Claude) into backend workflows'), 'building AI, not using it')
    assert.ok(!has('AI-assisted operational scenarios for robots'))
    assert.ok(!has('AI-powered tools to support better communication'))
    assert.ok(!has('We use Claude Code daily', { ...profile, aiTools: false }), 'off unless chosen')
    // Not a tech rule: stays outside the tech bonus cap
    const capped = scoreJob('Senior React Developer', 'React. Claude Code', buildRules(profile), { techBonusCap: 5 })
    assert.ok(capped.reasons.some((r) => r.label === 'AI-інструменти' && r.weight === 10))
    assert.ok(capped.reasons.some((r) => r.label === 'Понад ліміт за технології (5)' && r.weight === -10))
})

test('office means an office: not "Officer", back-office or home office; old saved patterns get fixed', () => {
    const base: Profile = {
        techs: [],
        unwanted: [],
        direction: 'frontend',
        level: 'senior',
        teamLead: false,
        techLead: false,
        staff: false,
        aiTools: false,
        languages: [],
        formats: { remote: true, hybrid: true, office: true, relocation: false },
        city: 'Одеса',
        companyType: 'any',
        fullstackAllowed: null,
    }
    const rules = buildRules(base)
    const office = (desc: string) =>
        scoreJob('Engineer', `${desc}. Одеса`, rules).reasons.some((r) => r.label === 'Офіс: Одеса')
    assert.ok(
        office('Office in Odesa') && office('Працюємо в офісі') && office('2 days onsite') && office('our offices'),
    )
    assert.ok(!office('You will report to the Chief Operating Officer'))
    assert.ok(!office('official partner, back-office systems, home office setup'))

    // An office or hybrid is a plus only in the user's city: a Kyiv office with remote work is remote, not an office
    const labels = (desc: string) => scoreJob('Front-End Engineer', desc, rules).reasons.map((r) => r.label)
    const kyiv = labels('Київ, віддалено\nСніданки та обіди в офісі. Автономний офіс.')
    assert.ok(
        kyiv.includes('Remote') && !kyiv.includes('Офіс: Одеса') && !kyiv.some((l) => l.startsWith('Офіс/гібрид')),
    )
    assert.ok(!labels('Hybrid, Kyiv').includes('Гібрид: Одеса'))
    assert.ok(labels('Hybrid, Kyiv').includes('Офіс/гібрид не в місті Одеса'))
    assert.ok(labels('Гібрид, Одеса,\nофіс на Дерибасівській').includes('Гібрид: Одеса'))

    // Remote for some days of the week is hybrid, not remote
    for (const desc of [
        '2 days remote per week, Одеса',
        'Remote 2 days a week, office in Одеса',
        '2 дні на тиждень віддалено, офіс в Одесі',
        'Віддалено 2 дні, Одеса',
        '3 days in the office, Одеса',
        'Partially remote, Одеса',
    ]) {
        const got = labels(desc)
        assert.ok(!got.includes('Remote') && got.includes('Гібрид: Одеса'), `${desc}: ${got.join(', ')}`)
    }
    assert.ok(labels('2 days remote, office in Kyiv').includes('Офіс/гібрид не в місті Одеса'), 'no remote option')
    for (const desc of ['Remote', 'Fully remote, 5 days a week', 'Повністю віддалено', 'Remote-first team of 12'])
        assert.ok(labels(desc).includes('Remote'), desc)

    const oldRemote = [
        { pattern: 'remote|віддален|удален|дистанційн', weight: 15, label: 'Remote' },
        {
            pattern: 'office|офіс|офис|hybrid|гібрид|гибрид|on-?site',
            weight: -20,
            label: 'Офіс/гібрид не в місті Одеса',
            unless: 'remote|віддален|удален|дистанційн|одес',
        },
    ]
    const upgradedRemote = upgradeRules(oldRemote)!
    const partTime = scoreJob('Engineer', '2 days remote, office in Kyiv', upgradedRemote).reasons
    assert.deepEqual(
        partTime.map((r) => r.weight),
        [-20],
        'saved rules learn it too: no Remote bonus, and no remote option to cancel the office elsewhere',
    )
    assert.equal(upgradeRules(upgradedRemote), null)

    const old = [
        { pattern: 'office|офіс|офис|on-?site', weight: 5, label: 'Офіс' },
        { pattern: 'office|офіс|офис|hybrid|гібрид|гибрид|on-?site', weight: -20, label: 'Офіс/гібрид не в Одесі' },
        { pattern: 'my own office', weight: 3, label: 'edited by the user' },
    ]
    const upgraded = upgradeRules(old)!
    const noCity = buildRules({ ...base, city: '' })
    assert.deepEqual(
        upgraded.map((r) => r.pattern),
        [noCity.find((r) => r.label === 'Офіс')!.pattern, upgraded[1].pattern, 'my own office'],
    )
    // With a «Місто» rule saved, the old office and hybrid bonuses are tied to that city
    const withCity = upgradeRules([
        ...old,
        ...noCity.filter((r) => r.label === 'Гібрид'),
        rules.find((r) => r.label === 'Місто: Одеса')!,
    ])!
    assert.deepEqual(
        withCity
            .filter((r) => r.label.startsWith('Офіс:') || r.label.startsWith('Гібрид'))
            .map((r) => [r.label, r.pattern]),
        ['Офіс: Одеса', 'Гібрид: Одеса'].map((l) => [l, rules.find((r) => r.label === l)!.pattern]),
    )
    assert.equal(upgradeRules(rules), null, 'rules made now need nothing')
    assert.ok(
        !scoreJob('Engineer', 'Chief Operating Officer, hybrid', upgraded).reasons.some((r) => r.label === 'Офіс'),
    )
    assert.equal(upgradeRules(upgraded), null, 'nothing left to fix')
})

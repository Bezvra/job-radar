import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TECHS } from '../src/core/techs'
import { scoreJob } from '../src/core/scoring'
import { DEFAULT_SETTINGS } from '../src/core/defaults'
import { RULES, SETTINGS } from './fixtures'

test('scores fitting job high and off-profile jobs low', () => {
    const good = scoreJob('Senior React Developer', 'product company, React, TypeScript, Redux, GraphQL, remote', RULES)
    const bad = scoreJob('Junior Angular Developer', 'Angular, only office', RULES)
    const fs = scoreJob('Full Stack Engineer (PHP/Vue)', 'Laravel, Vue, outsourcing', RULES)
    console.log('   scores:', good.score, bad.score, fs.score)
    assert.ok(good.score >= SETTINGS.applyThreshold)
    assert.equal(bad.score, 0)
    assert.ok(fs.score < SETTINGS.hideBelow)
})

test('full stack is penalized unless the backend is .NET', () => {
    const fs = (title: string, desc: string) =>
        scoreJob(title, desc, RULES).reasons.some((r) => r.label === 'Full stack не на .NET')
    assert.ok(fs('Senior Full-Stack Developer (React + Python)', 'Django, PostgreSQL'))
    assert.ok(fs('Fullstack Engineer', 'Node.js, React. Apply at example.net'), 'a .net domain is not .NET')
    assert.ok(!fs('Full Stack Developer ( .NET + React)', 'React, TypeScript'))
    assert.ok(!fs('Senior Full Stack Engineer', 'C#, ASP.NET Core, React'))
    assert.ok(!fs('Senior Frontend Engineer', 'React, Python'), 'not full stack')
})

test('bad user regex does not crash scoring', () => {
    assert.doesNotThrow(() => scoreJob('x', 'y', [{ pattern: '(', weight: 5, label: 'bad' }]))
})

test('techs not in the filters count against the job: title per tech, description capped', () => {
    const { rules, unlistedTech } = SETTINGS
    const s = (title: string, desc: string) => scoreJob(title, desc, rules, { unlistedTech })
    const node = s('Senior Full-Stack Developer (Node.js + React)', 'Remote. React, TypeScript')
    assert.ok(node.reasons.some((r) => r.label === 'Node.js — не у фільтрах' && r.weight === -15))
    // Covered techs aren't penalized: React (+), Vue (−8 rule), JavaScript (neutral 0 rule)
    const covered = s('Senior React Developer', 'JavaScript, Vue, TypeScript')
    assert.ok(!covered.reasons.some((r) => r.label.includes('не у фільтрах') || r.label.startsWith('Інший стек')))
    assert.ok(!covered.reasons.some((r) => r.weight === 0), 'neutral rules add nothing visible')
    assert.deepEqual(covered.neutral, ['JavaScript'], 'a weight-0 rule shows up as a neutral tech')
    // Tooling outside the stack penalty (DevOps) is neutral; penalized and rewarded techs aren't listed again
    const mixed = s('Senior React Developer', 'React, Docker, AWS, Spring')
    assert.deepEqual(mixed.neutral, ['Docker', 'AWS'])
    // Description: stack techs only, at most 5 counted; Docker/AWS (DevOps) are fine
    const many = s('Senior React Developer', 'Go, Java, Python, Ruby, Rust, Scala, Kotlin, Docker, AWS')
    const other = many.reasons.find((r) => r.label.startsWith('Інший стек'))!
    assert.equal(other.weight, unlistedTech.description * 5, 'capped at 5 techs')
    assert.ok(!other.label.includes('Docker') && !other.label.includes('AWS'))
    assert.ok(
        !scoreJob('Java Developer', '', rules).reasons.some((r) => r.label.includes('не у фільтрах')),
        'off without the setting',
    )
})

test('tech bonus is capped so level and role still decide', () => {
    const rules = ['react', 'typescript', 'redux', 'graphql', 'nextjs'].map((id) => ({
        pattern: TECHS.find((x) => x.id === id)!.pattern,
        weight: 15,
        label: TECHS.find((x) => x.id === id)!.name,
    }))
    rules.push({ pattern: 'junior', weight: -40, label: 'Junior' })
    const stack = 'React, TypeScript, Redux, GraphQL, Next.js'
    const uncapped = scoreJob('Junior React Developer', stack, rules)
    const capped = scoreJob('Junior React Developer', stack, rules, { techBonusCap: 30 })
    assert.equal(uncapped.score, 55, '20 + 75 − 40')
    assert.equal(capped.score, 10, '20 + 30 − 40')
    assert.ok(capped.reasons.some((r) => r.label === 'Понад ліміт за технології (30)' && r.weight === -45))
    assert.equal(
        scoreJob('React Developer', 'React', rules, { techBonusCap: 30 }).score,
        35,
        'under the cap: unchanged',
    )
})

test('no built-in rules: every job keeps the base score until the wizard runs', () => {
    assert.deepEqual(DEFAULT_SETTINGS.rules, [])
    assert.deepEqual(DEFAULT_SETTINGS.sources, [], 'sources come from the wizard too')
    const r = scoreJob('Senior Java Developer', 'Spring, Kotlin, PHP', DEFAULT_SETTINGS.rules, DEFAULT_SETTINGS)
    assert.equal(r.score, 20)
    assert.deepEqual(r.reasons, [])
    assert.deepEqual(r.neutral, ['Java', 'Spring', 'Kotlin', 'PHP'], 'mentioned, but nothing to score them against')
})

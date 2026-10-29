import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cvLanguages, languageRules } from '../src/core/language'
import { scoreJob } from '../src/core/scoring'

test('language level: penalize a higher required level or a language the user lacks; ranges with theirs are fine', () => {
    const penalty = (desc: string, skills: { id: string; level: number }[]) =>
        scoreJob('Engineer', desc, languageRules(skills)).reasons.find((r) => r.weight < 0)?.label ?? null
    const b2 = [{ id: 'en', level: 4 }]
    assert.equal(penalty('English: C1 or higher', b2), 'Англійська вище B2')
    assert.equal(penalty('Fluent written and spoken English', b2), 'Англійська вище B2')
    assert.equal(penalty('Upper-Intermediate (B2) English', b2), null)
    assert.equal(penalty('English: Advanced (B2-C1)', b2), null, 'a range including B2')
    assert.equal(penalty('English Speaking Club with a native speaker', b2), null, 'a perk, not a requirement')
    assert.equal(penalty('Англійська — вище середнього', [{ id: 'en', level: 3 }]), 'Англійська вище B1')
    assert.equal(penalty('Англійська — середній, B2B SaaS', [{ id: 'en', level: 3 }]), null)
    assert.equal(penalty('English: B1+', []), 'Англійська (не володієш)')
    assert.equal(
        penalty('French-speaking team', b2),
        'Інша мова: українська, німецька, польська, французька, іспанська',
    )
    assert.equal(penalty('Fluent Ukrainian and English', [...b2, { id: 'uk', level: 6 }]), 'Англійська вище B2')
    assert.equal(penalty('Українська — вільно', [{ id: 'uk', level: 6 }]), null, 'C2 has nothing above')
    assert.equal(penalty('Polished UI, office in Germany', b2), null)
    assert.equal(penalty('Deutsch B2', [...b2, { id: 'de', level: 4 }]), null)

    assert.deepEqual(cvLanguages('LANGUAGES\nEnglish: Upper-Intermediate (B2)\nUkrainian: native'), [
        { id: 'en', level: 4 },
        { id: 'uk', level: 6 },
    ])
    assert.deepEqual(cvLanguages('Мови: англійська — середній, німецька — початковий'), [
        { id: 'en', level: 3 },
        { id: 'de', level: 1 },
    ])
    assert.deepEqual(cvLanguages('React, TypeScript'), [])
})

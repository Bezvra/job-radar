import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRss } from '../src/core/rss'
import { normalize } from '../src/core/normalize'
import { isRelevant, mergeFeed } from '../src/core/collect'
import { belowMinSalary, findSalary, formatSalary } from '../src/core/salary'
import type { Job } from '../src/core/types'
import { SETTINGS, DJINNI, DOU } from './fixtures'

test('finds salaries in Djinni descriptions and DOU titles, ignores bonuses and budgets', () => {
    const s = (title: string, desc: string) => {
        const found = findSalary(title, desc)
        return found && formatSalary(found)
    }
    // Djinni puts the salary first; DOU's ends up in the "Локація:" line after normalize
    assert.equal(s('Front-end developer', '2500 – 3000$, В залежності від рівня'), '$2500–3000')
    const dou = normalize(parseRss(DOU.replace('в Acme Labs, віддалено', 'в Acme Labs, $1900–2200, віддалено'))[0])
    assert.deepEqual(findSalary(dou.title, dou.description), { min: 1900, max: 2200, currency: 'USD', period: 'month' })
    assert.equal(s('Full Stack Developer', 'Stack: React. Rate: Up to $20/hour. Employment: Full-time'), 'до $20/год')
    assert.equal(s('Frontend', 'Зарплата від 60 000 грн, віддалено'), 'від 60 000 грн')
    assert.equal(s('Frontend', 'We offer a $1000 sign-on bonus and a $500 learning budget'), null)
    assert.equal(s('Frontend', 'Compensation in USD. 10–50 співробітників'), null)
})

test('jobs below the minimum salary are not relevant; without a salary or an upper bound they stay', () => {
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 's', SETTINGS)
    const good = Object.values(jobs).find((j) => j.score >= SETTINGS.applyThreshold)!
    const now = new Date('2026-10-27T00:00:00Z')
    const want = { ...SETTINGS, minSalary: 4000 }
    assert.equal(good.salary, null)
    assert.ok(isRelevant(good, want, now), 'no salary stated')
    good.salary = { min: 2500, max: 3000, currency: 'USD', period: 'month' }
    assert.ok(!isRelevant(good, want, now))
    assert.ok(isRelevant(good, SETTINGS, now), 'no minimum set')
    good.salary = { max: 30, currency: 'USD', period: 'hour' } // ≈ $4800/month
    assert.ok(isRelevant(good, want, now))
    good.salary = { min: 2000, currency: 'USD', period: 'month' }
    assert.ok(!belowMinSalary(good.salary, 4000), '"from $2000" might still fit')
})

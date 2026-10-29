import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diagnostics } from '../src/core/diagnostics'
import type { Job } from '../src/core/types'
import { NOW, SETTINGS } from './fixtures'

test('diagnostics: what a bug report needs, and nothing personal', () => {
    const settings = {
        ...SETTINGS,
        telegram: { enabled: true, botToken: '123456:SECRET-token', chatId: '987654321' },
    }
    const job = { id: 'a', title: 'Secret Project Lead', description: 'confidential', status: 'saved' } as Job
    const text = diagnostics({
        version: '0.4.3',
        userAgent: 'Chrome/156',
        browserLanguage: 'uk-UA',
        settings,
        jobs: { a: job, b: { ...job, id: 'b', status: 'new' } },
        lastRun: {
            at: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
            results: [
                { name: 'Djinni · React.js', ok: true, count: 12 },
                { name: 'DOU · Front End', ok: false, count: 0, error: 'HTTP 429' },
            ],
            newRelevant: 2,
        },
        alarm: { scheduledTime: NOW.getTime() + 90 * 60_000, periodInMinutes: 180 },
        now: NOW,
    })
    for (const expected of [
        'IT Job Radar 0.4.3',
        'every 3 h',
        'in 90 min, period 180 min',
        '30 min ago',
        'ERR DOU · Front End: 0 (HTTP 429)',
        `Sources (${SETTINGS.sources.filter((s) => s.enabled).length} enabled`,
        'Jobs: 2 (saved 1, new 1)',
        'token set, chat set',
    ])
        assert.ok(text.includes(expected), expected)
    for (const secret of ['SECRET', '987654321', 'Secret Project', 'confidential', SETTINGS.rules[0].pattern])
        assert.ok(!text.includes(secret), secret)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importJobs, makeBackup, readBackup } from '../src/core/backup'
import type { Job } from '../src/core/types'
import { NOW, RULES, SETTINGS, SOURCES } from './fixtures'

const job = (id: string, status: Job['status']): Job => ({
    id,
    title: `Senior React Developer ${id}`,
    company: 'Acme',
    url: `https://djinni.co/jobs/${id}/`,
    description: 'React',
    publishedAt: null,
    sourceIds: ['djinni-react'],
    firstSeen: NOW.toISOString(),
    score: 70,
    reasons: [],
    status,
})

test('backup: keeps the settings and only saved and applied jobs, and reads back', () => {
    const settings = { ...SETTINGS, rules: RULES, sources: SOURCES }
    const jobs = { a: job('a', 'new'), b: job('b', 'saved'), c: job('c', 'applied'), d: job('d', 'hidden') }
    const backup = makeBackup(settings, jobs, '0.4.2', NOW)
    assert.deepEqual(
        backup.jobs.map((j) => j.id),
        ['b', 'c'],
    )
    const read = readBackup(JSON.stringify(backup))!
    assert.deepEqual(read.settings, settings)
    assert.deepEqual(read.jobs, backup.jobs)
})

test('backup: rejects other files; fills missing settings and job fields', () => {
    assert.equal(readBackup('not json'), null)
    assert.equal(readBackup('{"settings": {}}'), null, 'no format mark')
    assert.equal(readBackup('{"format": "it-job-radar-backup", "settings": {"rules": "x"}}'), null)

    const old = {
        format: 'it-job-radar-backup',
        settings: { rules: RULES, sources: SOURCES, applyThreshold: 70 },
        jobs: [
            { id: 'x', title: 'Dev', url: 'https://example.com/x', status: 'saved' },
            { id: 'y', title: 'Dev', url: 'https://example.com/y', status: 'new' },
            'junk',
        ],
    }
    const read = readBackup(JSON.stringify(old), NOW)!
    assert.equal(read.settings.applyThreshold, 70)
    assert.equal(read.settings.locale, 'auto', 'a field the old version lacked gets its default')
    assert.equal(read.jobs.length, 1)
    assert.deepEqual(read.jobs[0].sourceIds, [])
    assert.equal(read.jobs[0].description, '')
})

test('backup: import adds jobs and keeps a status that got further', () => {
    const jobs: Record<string, Job> = { a: job('a', 'applied'), b: job('b', 'new') }
    importJobs(jobs, [job('a', 'saved'), job('b', 'saved'), job('c', 'applied')])
    assert.equal(jobs.a.status, 'applied')
    assert.equal(jobs.b.status, 'saved')
    assert.equal(jobs.c.status, 'applied')
})

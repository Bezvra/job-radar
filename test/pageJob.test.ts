import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addPageJob, mergeFeed, pageToJob } from '../src/core/collect'
import {
    jobFromPage,
    linkedinTitle,
    type PageSnapshot,
    SALARY_TEXT,
    SITE_SELECTORS,
    selectorsFor,
} from '../src/core/pageJob'
import type { Job } from '../src/core/types'
import { DJINNI, SETTINGS } from './fixtures'

// What the popup reads from a tab (see snapshotPage in pages/popup.tsx); each test fills in what its page has
const blank: PageSnapshot = {
    url: '',
    title: '',
    ldJson: [],
    picked: { title: '', company: '', top: '', salary: '', description: '' },
    h1: '',
    selection: '',
    text: '',
}

const posting = {
    '@context': 'https://schema.org',
    '@graph': [
        { '@type': 'Organization', name: 'Site' },
        {
            '@type': 'JobPosting',
            title: 'Senior React Developer',
            hiringOrganization: { '@type': 'Organization', name: 'Acme' },
            description: '<p>We use <b>React</b> &amp; TypeScript.</p><p>English: B2</p>',
            datePosted: '2026-10-26T10:00:00Z',
            jobLocationType: 'TELECOMMUTE',
            baseSalary: { currency: 'USD', value: { minValue: 4000, maxValue: 5500, unitText: 'MONTH' } },
        },
    ],
}

const ldJob = () =>
    jobFromPage({
        ...blank,
        url: 'https://www.work.ua/jobs/123/?utm_source=x#apply',
        ldJson: ['{broken', JSON.stringify(posting)],
        h1: 'ignored, JSON-LD has the title',
    })!

test('page job: JSON-LD JobPosting gives the title, company, date, salary and the remote flag', () => {
    const ld = ldJob()
    assert.equal(ld.url, 'https://www.work.ua/jobs/123')
    assert.equal(ld.title, 'Senior React Developer')
    assert.equal(ld.company, 'Acme')
    assert.equal(ld.publishedAt, '2026-10-26T10:00:00.000Z')
    assert.match(ld.description, /^4000–5500 USD\nRemote\nWe use React & TypeScript/)
    assert.equal(ld.guessed, false)
    const job = pageToJob(ld, SETTINGS, 'saved', new Date('2026-10-27'))
    assert.deepEqual(job.salary, { currency: 'USD', period: 'month', min: 4000, max: 5500 })
    assert.deepEqual(job.sourceIds, [])
    assert.ok(
        job.reasons.some((r) => r.label === 'Remote'),
        'the remote flag reaches the rules',
    )
})

test('page job: LinkedIn URLs become /jobs/view/<id>, the top card goes before the description', () => {
    // The search pane: the job is ?currentJobId=…, and its top card says Remote itself
    const li = jobFromPage({
        ...blank,
        url: 'https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=react',
        picked: {
            ...blank.picked,
            title: 'Frontend Engineer',
            company: 'Globex',
            top: 'Kyiv · Remote · Full-time',
            description: 'About the job…',
        },
        text: 'whole page with other jobs',
    })!
    assert.equal(li.url, 'https://www.linkedin.com/jobs/view/4012345678')
    assert.equal(li.description, 'Kyiv · Remote · Full-time\nAbout the job…')
    const slug = jobFromPage({
        ...blank,
        url: 'https://ua.linkedin.com/jobs/view/react-dev-at-globex-4012345678',
        h1: 'X',
        text: 'Y',
    })!
    assert.equal(slug.url, 'https://www.linkedin.com/jobs/view/4012345678')
})

test('page job: LinkedIn tab title gives the role and company where the pane has no title element', () => {
    assert.deepEqual(linkedinTitle('Senior Frontend Engineer | ClickUp | LinkedIn'), {
        title: 'Senior Frontend Engineer',
        company: 'ClickUp',
    })
    assert.deepEqual(linkedinTitle('(3) Senior Software Engineer | Kimchi Studio | Kimchi | LinkedIn'), {
        title: 'Senior Software Engineer | Kimchi Studio',
        company: 'Kimchi',
    })
    assert.equal(linkedinTitle('(1) Вибір найкращих для вас вакансій | LinkedIn'), null)
    const search = jobFromPage({
        ...blank,
        url: 'https://www.linkedin.com/jobs/search-results/?currentJobId=4407908715&eBP=x',
        title: 'Senior Frontend Engineer | ClickUp | LinkedIn',
        h1: 'Вакансії, підібрані на основі ваших налаштувань',
        picked: { ...blank.picked, top: 'Remote', description: 'Про цю вакансію\nAngular 2+, NgRx, Typescript' },
    })!
    assert.deepEqual(
        [search.url, search.title, search.company],
        ['https://www.linkedin.com/jobs/view/4407908715', 'Senior Frontend Engineer', 'ClickUp'],
    )
    const elsewhere = jobFromPage({
        ...blank,
        url: 'https://careers.example.com/1',
        title: 'A | B | LinkedIn',
        h1: 'Dev',
        text: 'x',
    })!
    assert.equal(elsewhere.title, 'Dev', 'the tab title is read only on LinkedIn')
})

test('page job: a selection wins over the page text, unless it is too short to be a description', () => {
    const long = 'Requirements: 5+ years of React, TypeScript, testing. '.repeat(3)
    const page = { ...blank, url: 'https://careers.example.com/x', h1: 'Lead Frontend' }
    const sel = jobFromPage({ ...page, selection: long, text: 'menu' })!
    assert.equal(sel.description, long.trim())
    assert.equal(sel.guessed, false)
    const stray = jobFromPage({ ...page, selection: 'React', text: 'menu and the job' })!
    assert.equal(stray.description, 'menu and the job')
    assert.equal(stray.guessed, true, 'scored on the whole page')

    assert.equal(jobFromPage({ ...blank, url: 'https://example.com/', title: 'Empty' }), null)
    assert.equal(jobFromPage({ ...blank, url: 'not a url', h1: 'X', text: 'Y' }), null)
})

test('page job: each site gets its own selectors, and only on that site', () => {
    // LinkedIn's structural ones (a "/company/" link, an «About the job» heading) would misfire elsewhere
    assert.equal(selectorsFor('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=1'), SITE_SELECTORS)
    assert.equal(selectorsFor('https://ua.linkedin.com/jobs/view/1'), SITE_SELECTORS)
    assert.deepEqual(selectorsFor('https://notlinkedin.com/x').title, [])
    assert.deepEqual(selectorsFor('https://careers.example.com/jobs/1/').title, [])
    assert.deepEqual(selectorsFor('https://jobs.dou.ua/companies/x/vacancies/1/').salary, ['.sh-info .salary'])
    assert.equal(selectorsFor('https://www.work.ua/jobs/1/').cardCompany, 'a[href*="/jobs/by-company/"]')
    assert.equal(selectorsFor('https://robota.ua/company13611309/vacancy11383538').title[0], 'h1')
    assert.ok(new RegExp(SITE_SELECTORS.descriptionHeading, 'i').test('Про цю вакансію'))
})

test('page job: an element reading just a salary is recognized, a sentence with an amount is not', () => {
    const salaryText = new RegExp(SALARY_TEXT, 'i')
    assert.ok(
        ['Від 1200$', '$400–800', '25 000 – 35 000 грн', 'до 3 000 €', '75 000 ₴'].every((x) => salaryText.test(x)),
    )
    assert.ok(!['Середня зарплата 30 000 грн', 'React 18', '2024'].some((x) => salaryText.test(x)))
})

test('page job: saving a page that is already a feed job only changes its status', () => {
    const jobs: Record<string, Job> = {}
    mergeFeed(jobs, DJINNI, 's', SETTINGS)
    const [feedJob] = Object.values(jobs)
    const again = pageToJob({ ...ldJob(), id: feedJob.id, url: feedJob.url }, SETTINGS, 'applied')
    assert.equal(addPageJob(jobs, again), feedJob)
    assert.equal(feedJob.status, 'applied')
    assert.deepEqual(feedJob.sourceIds, ['s'])
})

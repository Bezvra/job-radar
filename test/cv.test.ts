import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeCv, experienceYears, splitCv } from '../src/core/cv'
import { TECHS } from '../src/core/techs'
import { CV, NOW } from './fixtures'

test('CV split: date ranges in several formats start jobs, headings end them', () => {
    const blocks = splitCv(CV, NOW)
    const dated = blocks.filter((b) => b.end)
    assert.deepEqual(
        dated.map((b) => [b.start!.getUTCFullYear(), b.start!.getUTCMonth(), b.end!.getUTCFullYear()]),
        [
            [2022, 2, 2026],
            [2019, 2, 2022],
            [2016, 0, 2019],
            [2010, 0, 2015],
        ],
    )
    assert.ok(!dated[2].text.includes('State Technical University'), 'Education heading ends the last job')
    assert.ok(blocks.at(-1)!.text.startsWith('CORE SKILLS') && !blocks.at(-1)!.end, 'skills list is undated')
    // Headings in other words and languages; a "Stack: …" line inside a job is not a heading
    const uk = splitCv('Досвід\nAcme | 2020 – 2022\nStack: React, Skills\nТехнічні навички\nReact', NOW)
    assert.equal(uk.length, 3)
    assert.ok(uk[1].text.includes('Stack: React') && uk[2].text.startsWith('Технічні навички'))
})

test('CV analysis rates recent and frequent techs higher', () => {
    const f = Object.fromEntries(analyzeCv(CV, NOW).map((x) => [x.tech.id, x]))
    assert.equal(f.react.jobsWith, 2)
    assert.equal(f.react.jobsTotal, 3, 'education has no tech, so it is not a job')
    assert.ok(f.react.relevance > f.graphql.relevance, 'used in more jobs')
    assert.ok(f.graphql.relevance > f.angular.relevance, 'used more recently')
    // Recency by position: latest job 1, previous 2/3; React is in both of the 2 latest of 3 jobs
    assert.equal(f.react.relevance, 87)
    assert.equal(f.graphql.relevance, 53, 'previous job only')
    assert.equal(f.react.weight, 17)
    assert.equal(f.docker.lastUsed, null, 'only in the skills list')
    assert.ok(!f.reactnative && !f.java, 'no React Native or Java false positives')
    assert.ok(Math.round(experienceYears(CV, NOW)) === 11, 'experience counted from the first job, not education')
})

test('tech dictionary patterns are valid and avoid known false positives', () => {
    const hit = (id: string, s: string) => new RegExp(TECHS.find((x) => x.id === id)!.pattern, 'i').test(s)
    for (const x of TECHS) assert.doesNotThrow(() => new RegExp(x.pattern, 'i'), x.id)
    assert.ok(!hit('java', 'JavaScript') && hit('java', 'Java 17'))
    assert.ok(!hit('react', 'React Native') && hit('react', 'React.js') && hit('reactnative', 'React-Native'))
    assert.ok(!hit('dotnet', 'apply at example.net') && hit('dotnet', 'ASP.NET Core') && hit('dotnet', '.NET 8'))
    assert.ok(!hit('go', 'ready to go') && hit('go', 'Golang') && hit('go', 'Backend Engineer (Go)'))
    // In a CV, capitalized "Go" is the language
    const cvGo = (s: string) => analyzeCv(`Acme | 2020 – 2022\n${s}`, NOW).some((x) => x.tech.id === 'go')
    assert.ok(
        cvGo('Stack: Go, gRPC') && cvGo('a new Go platform') && !cvGo('ready to go live') && !cvGo('Go-to person'),
    )
    // Android in a CV: development, not shipping into "our iOS and Android apps"
    const cvTech = (id: string, s: string) => analyzeCv(`Acme | 2020 – 2022\n${s}`, NOW).some((x) => x.tech.id === id)
    assert.ok(cvTech('android', 'Android developer, Kotlin') && cvTech('android', 'Skills: React Native, Android, iOS'))
    assert.ok(cvTech('android', 'Built Android apps in Kotlin'))
    assert.ok(!cvTech('android', "shipped it into ICC's existing iOS and Android apps"))
    assert.ok(!cvTech('android', 'released to the Android and iOS apps'))
    assert.ok(!cvTech('android', 'tested on Android devices'))
    assert.ok(hit('android', 'our iOS and Android apps'), 'jobs keep the plain pattern')
    assert.ok(hit('csharp', 'C#') && hit('cpp', 'C++'))
})

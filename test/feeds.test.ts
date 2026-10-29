import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    djinniExperience,
    feedName,
    suggestFeeds,
    toFeedUrl,
    toSources,
    unknownDjinniKeywords,
} from '../src/core/feeds'

test('feeds: a search page becomes its RSS feed, named from its filters; suggestions follow the stack', () => {
    assert.equal(
        toFeedUrl('https://djinni.co/jobs/?primary_keyword=React.js&exp_level=5y&page=2'),
        'https://djinni.co/jobs/rss/?primary_keyword=React.js&exp_level=5y',
    )
    assert.equal(
        toFeedUrl('https://jobs.dou.ua/vacancies/?category=Front+End&exp=5plus#top'),
        'https://jobs.dou.ua/vacancies/feeds/?category=Front%20End&exp=5plus',
    )
    assert.equal(
        toFeedUrl('https://djinni.co/jobs/rss/?all_keywords=react'),
        'https://djinni.co/jobs/rss/?all_keywords=react',
    )
    assert.equal(toFeedUrl('https://djinni.co/my/profile/'), null)
    assert.equal(toFeedUrl('https://example.com/jobs/'), null)
    assert.equal(toFeedUrl('not a url'), null)

    assert.equal(
        feedName('https://djinni.co/jobs/rss/?primary_keyword=React.js&primary_keyword=Vue.js'),
        'Djinni · React.js, Vue.js',
    )
    assert.equal(
        feedName('https://jobs.dou.ua/vacancies/feeds/?category=Front%20End&exp=5plus'),
        'DOU · Front End + фільтри',
    )
    assert.equal(feedName('https://jobs.dou.ua/vacancies/feeds/?search=React'), 'DOU · пошук «React»')
    assert.equal(feedName('https://djinni.co/jobs/rss/'), 'Djinni · усі вакансії')

    // Djinni ignores a key it doesn't know (wrong case) and returns every category
    assert.deepEqual(unknownDjinniKeywords('https://djinni.co/jobs/rss/?primary_keyword=React'), ['React'])
    assert.deepEqual(unknownDjinniKeywords('https://djinni.co/jobs/rss/?primary_keyword=React.js'), [])
    assert.deepEqual(unknownDjinniKeywords('https://jobs.dou.ua/vacancies/feeds/?category=React'), [])

    const react = suggestFeeds(['react', 'typescript', 'nodejs'], 'frontend')
    assert.deepEqual(
        react.map((f) => [f.name, f.checked]),
        [
            ['Djinni · React.js', true],
            ['Djinni · JavaScript', true],
            ['Djinni · Node.js', false],
            ['DOU · пошук «React»', true],
            ['DOU · Front End', true],
            ['DOU · Node.js', false],
        ],
    )
    const go = suggestFeeds(['go', 'postgres'], 'backend')
    assert.deepEqual(
        go.map((f) => f.url),
        ['https://djinni.co/jobs/rss/?primary_keyword=Golang', 'https://jobs.dou.ua/vacancies/feeds/?category=Golang'],
    )
    assert.deepEqual(suggestFeeds(['postgres'], 'backend'), [])

    // Djinni's experience filter: from the level's start to a year beyond the CV's experience
    assert.deepEqual(djinniExperience('senior', 6.5), ['3y', '4y', '5y', '6y', '7y'])
    assert.deepEqual(djinniExperience('senior', 14), ['3y', '4y', '5y', '6y', '7y', '8y', '9y', '10y'])
    assert.deepEqual(djinniExperience('senior', null).length, 8, 'no CV: 3 years and up')
    assert.deepEqual(djinniExperience('junior', 0.5), ['no_exp', '1y'])
    assert.deepEqual(djinniExperience('middle', 0), ['1y'], 'a level picked above the CV: at least its start')
    const senior = suggestFeeds(['react'], 'frontend', djinniExperience('senior', 6.5))
    assert.equal(
        senior[0].url,
        'https://djinni.co/jobs/rss/?primary_keyword=React.js&exp_level=3y&exp_level=4y&exp_level=5y&exp_level=6y&exp_level=7y',
    )
    assert.equal(senior[0].name, 'Djinni · React.js · досвід 3–7 р.')
    assert.ok(!senior.some((f) => f.url.includes('dou.ua') && f.url.includes('exp')), 'DOU feeds unchanged')
    assert.equal(
        feedName('https://djinni.co/jobs/rss/?primary_keyword=Golang&exp_level=5y&exp_level=10y'),
        'Djinni · Golang · досвід 5–10+ р.',
    )

    // A feed that's already a source keeps its id; a new Djinni feed reads job pages for the company
    const existing = [{ id: 'dou-old', name: 'Мій DOU', url: go[1].url, enabled: false }]
    const [djinni, dou] = toSources(go, existing)
    assert.equal(djinni.fetchPages, true)
    assert.match(djinni.id, /^src-/)
    assert.deepEqual(dou, { ...existing[0], name: 'DOU · Golang', enabled: true })
})

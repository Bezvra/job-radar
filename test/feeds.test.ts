import assert from 'node:assert/strict'
import { test } from 'node:test'
import { feedName, suggestFeeds, toFeedUrl, toSources, unknownDjinniKeywords } from '../src/core/feeds'

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

    // A feed that's already a source keeps its id; a new Djinni feed reads job pages for the company
    const existing = [{ id: 'dou-old', name: 'Мій DOU', url: go[1].url, enabled: false }]
    const [djinni, dou] = toSources(go, existing)
    assert.equal(djinni.fetchPages, true)
    assert.match(djinni.id, /^src-/)
    assert.deepEqual(dou, { ...existing[0], name: 'DOU · Golang', enabled: true })
})

// Chrome Web Store screenshots (1280×800) and promo tiles, from the built extension in headless Chrome, with made-up
// data only: a fictional CV goes through the real setup wizard, then fictional jobs at fictional companies are scored by
// the rules it made. Djinni, DOU and Telegram are mapped to localhost, so nothing leaves the machine.
//   npm run build && node store/screenshots.mjs        → store/images/
import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = resolve('store/images')
const PORT = 9555
/** The careers page's host: reserved for examples (RFC 2606), mapped to the local server */
const JOB_HOST = 'careers.aurora-robotics.example'
const JOB_URL = `http://${JOB_HOST}:${PORT}/job`
const DEBUG_PORT = 9337
const W = 1280
const H = 800
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- Made-up content -------------------------------------------------------------------------------------------

const CV = `<!doctype html><meta charset="utf-8"><style>body{font:13px/1.45 Georgia,serif;margin:48px;color:#111}h1{margin:0}h2{margin:22px 0 6px;font-size:15px;text-transform:uppercase;letter-spacing:.05em}p{margin:4px 0}</style>
<h1>Marta Hlushko</h1><p>Senior Frontend Engineer · Kyiv, Ukraine</p>
<h2>Experience</h2>
<p><b>Northstar Fintech</b> — Senior Frontend Engineer<br>Mar 2022 – Present</p>
<p>Led the web app rewrite in React and TypeScript with Next.js and GraphQL. Built a design system in Storybook, tests in Jest and Playwright. React Query for data, WebSocket for live prices.</p>
<p><b>Brightline Studio</b> — Frontend Developer<br>06.2019 - 02.2022</p>
<p>React, TypeScript and Redux for a SaaS dashboard. Migrated the build to Webpack 5, wrote Jest tests.</p>
<p><b>Pixelworks</b> — Junior Web Developer<br>2017 — 2019</p>
<p>JavaScript, jQuery and SCSS landing pages; first React components.</p>
<h2>Education</h2><p>National Technical University, Computer Science, 2013 - 2017</p>
<h2>Skills</h2><p>React, TypeScript, Next.js, GraphQL, Redux, Jest, Playwright, Storybook, Docker</p>
<h2>Languages</h2><p>English — Upper-Intermediate (B2)<br>Ukrainian — native</p>`

const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString()

/** [site, title, company, hours since publishing, description] */
const JOBS = [
    [
        'djinni',
        'Senior Frontend Engineer (React, TypeScript)',
        'Northwind Labs',
        1,
        '$5000 – 6500. Product company building a payments platform for small businesses. React, TypeScript, Next.js and GraphQL, tests in Jest. Fully remote within Ukraine. English B2.',
    ],
    [
        'dou',
        'Senior React Developer',
        'Bluefin Software',
        3,
        'до $5500. Our own SaaS product for logistics. React, TypeScript, Redux Toolkit, Storybook. Remote. We use AI-assisted development with Cursor and Claude Code every day.',
    ],
    [
        'djinni',
        'Frontend Team Lead',
        'Polar Apps',
        5,
        'Lead a team of five frontend engineers on a product used by 2M people. React, TypeScript, Next.js. Hybrid, office in Kyiv, 2 days a week.',
    ],
    [
        'djinni',
        'Full Stack Engineer (Node.js + React)',
        'Starling Pay',
        8,
        'Node.js, NestJS, PostgreSQL and React. Outsourcing project for a fintech client. Remote.',
    ],
    [
        'dou',
        'Senior Front-End Developer',
        'Orbit Health',
        26,
        '$4500 – 5500. Healthcare product. React, TypeScript, React Query, Playwright. Remote, English Upper-Intermediate.',
    ],
    [
        'djinni',
        'Middle Frontend Developer (Vue)',
        'Kvitka Digital',
        30,
        'Vue 3, Nuxt, Pinia. Office in Lviv only. Outsourcing.',
    ],
    ['djinni', 'Junior Angular Developer', 'Lumen Soft', 34, 'Angular, RxJS. Office only, Dnipro.'],
]

const JOB_PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Senior Frontend Engineer · Aurora Robotics Careers</title>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: 'Senior Frontend Engineer',
    hiringOrganization: { '@type': 'Organization', name: 'Aurora Robotics' },
    datePosted: hoursAgo(20),
    jobLocationType: 'TELECOMMUTE',
    baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: { '@type': 'QuantitativeValue', minValue: 5500, maxValue: 7000, unitText: 'MONTH' },
    },
    description:
        '<p>Aurora Robotics builds fleet software for warehouse robots. You will own the operator console: React and TypeScript with Next.js, live data over WebSocket, a component library in Storybook and tests in Playwright.</p><p>Fully remote from Ukraine or the EU. English B2.</p>',
})}</script>
<style>body{margin:0;font:16px/1.6 -apple-system,system-ui,sans-serif;color:#1c2430;background:#f6f7fb}nav{background:#fff;border-bottom:1px solid #e3e6ee;padding:18px 64px;display:flex;gap:28px;align-items:center}nav b{font-size:20px;margin-right:auto;color:#3b4cca}main{max-width:760px;margin:40px 64px;background:#fff;border-radius:14px;padding:36px 44px;box-shadow:0 1px 3px #0001}h1{margin:0 0 6px;font-size:30px}.meta{color:#5d6778;margin-bottom:22px}.tag{display:inline-block;background:#eef0fb;color:#3b4cca;border-radius:6px;padding:2px 10px;margin-right:6px;font-size:14px}button{background:#3b4cca;color:#fff;border:0;border-radius:8px;padding:12px 22px;font-size:16px;margin-top:18px}</style>
<nav><b>Aurora Robotics</b><span>Product</span><span>Company</span><span>Careers</span></nav>
<main><h1>Senior Frontend Engineer</h1><div class="meta">Remote · Full-time · $5,500–7,000 / month</div>
<span class="tag">React</span><span class="tag">TypeScript</span><span class="tag">Next.js</span><span class="tag">WebSocket</span>
<p>Aurora Robotics builds fleet software for warehouse robots. You will own the operator console: React and TypeScript with Next.js, live data over WebSocket, a component library in Storybook and tests in Playwright.</p>
<p>Fully remote from Ukraine or the EU. English B2.</p><button>Apply now</button></main></html>`

// ---- Plumbing ----------------------------------------------------------------------------------------------------

const server = http
    .createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(
            req.url.startsWith('/cv')
                ? CV
                : req.url.startsWith('/job')
                  ? JOB_PAGE
                  : req.url.startsWith('/tile')
                    ? tiles.get(req.url)
                    : '',
        )
    })
    .listen(PORT)
const tiles = new Map()

// A copy of the build that may read the local careers page (the popup reads a tab through activeTab otherwise, which
// needs a click on the toolbar button)
const ext = mkdtempSync(join(tmpdir(), 'job-radar-shots-'))
cpSync('dist', ext, { recursive: true })
const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'))
manifest.host_permissions.push(`http://${JOB_HOST}/*`)
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest))
const profile = mkdtempSync(join(tmpdir(), 'job-radar-profile-'))

const chrome = spawn(
    CHROME,
    [
        '--headless',
        '--remote-debugging-pipe',
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--enable-unsafe-extension-debugging',
        `--host-resolver-rules=MAP ${JOB_HOST} 127.0.0.1, MAP djinni.co ~NOTFOUND, MAP jobs.dou.ua ~NOTFOUND, MAP api.telegram.org ~NOTFOUND`,
        '--hide-scrollbars',
        `--user-data-dir=${profile}`,
        'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
)
let extId
chrome.stdio[4].on('data', (d) => (extId ??= String(d).match(/"id":"([a-z]{32})"/)?.[1]))
chrome.stdio[3].write(JSON.stringify({ id: 1, method: 'Extensions.loadUnpacked', params: { path: ext } }) + '\0')
await sleep(3000)
const extUrl = (path) => `chrome-extension://${extId}/${path}`

/** A tab driven over CDP */
async function tab(url, { width = W, height = H, init } = {}) {
    const target = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((r) => (ws.onopen = r))
    let id = 0
    const pending = new Map()
    ws.onmessage = (m) => {
        const d = JSON.parse(m.data)
        pending.get(d.id)?.(d)
    }
    const send = (method, params = {}) =>
        new Promise((r) => {
            pending.set(++id, r)
            ws.send(JSON.stringify({ id, method, params }))
        })
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    if (init) await send('Page.addScriptToEvaluateOnNewDocument', { source: init })
    const go = async (to) => {
        await send('Page.navigate', { url: to })
        await sleep(1500)
    }
    await go(url)
    const run = async (expression) => {
        const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (out.result?.exceptionDetails) throw new Error(out.result.exceptionDetails.exception?.description)
        return out.result?.result?.value
    }
    const shot = async (file, clip) => {
        const s = await send('Page.captureScreenshot', { format: 'png', ...(clip && { clip: { ...clip, scale: 1 } }) })
        if (file) writeFileSync(join(OUT, file), Buffer.from(s.result.data, 'base64'))
        return s.result.data
    }
    const close = () => fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${target.id}`)
    return { send, run, go, shot, close }
}

/** Clicks the button whose text is one of `texts` */
const click = (texts) =>
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => ${JSON.stringify(texts)}.includes(b.textContent.trim())); if (!b) throw new Error('no button ' + ${JSON.stringify(texts.join(' / '))}); b.click(); return true })()`

mkdirSync(OUT, { recursive: true })

// The fictional CV as a PDF, for the wizard's upload
const cvPage = await tab(`http://127.0.0.1:${PORT}/cv`)
const pdf = await cvPage.send('Page.printToPDF', { printBackground: true })
const cvPath = join(ext, '..', 'marta-hlushko-cv.pdf')
writeFileSync(cvPath, Buffer.from(pdf.result.data, 'base64'))
await cvPage.close()

const TEXT = {
    uk: { next: 'Далі →', save: 'Зберегти', sources: '4. Джерела' },
    en: { next: 'Next →', save: 'Save', sources: '4. Sources' },
}

for (const locale of ['uk', 'en']) {
    const n = (i, name) => `${locale}-${i}-${name}.png`

    // 1. The wizard, from the CV: the technologies step
    const wizard = await tab(extUrl('onboarding.html'))
    await wizard.run(
        `chrome.storage.local.clear().then(() => chrome.storage.local.set({ settings: { locale: '${locale}' } })).then(() => location.reload())`,
    )
    await sleep(1500)
    const { root } = (await wizard.send('DOM.getDocument')).result
    const input = (await wizard.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })).result
    await wizard.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [cvPath] })
    await sleep(3000)
    await wizard.shot(n(2, 'setup-from-cv'))
    // Through the preferences (as guessed from the CV) and the suggested feeds; the refresh it starts is dropped
    await wizard.run(click([TEXT[locale].next]))
    await sleep(500)
    await wizard.run(click([TEXT[locale].next]))
    await sleep(500)
    await wizard.run(
        `(() => { const send = chrome.runtime.sendMessage.bind(chrome.runtime); chrome.runtime.sendMessage = (m, ...r) => (m?.type === 'refresh' ? Promise.resolve() : send(m, ...r)); return 1 })()`,
    )
    await wizard.run(click([TEXT[locale].save]))
    await sleep(2500) // now on the options page, Filters tab

    // 2. Fictional jobs from the feeds the wizard chose, scored by the worker with the rules it made
    const sources = await wizard.run(`chrome.storage.local.get('settings').then(({ settings }) => settings.sources)`)
    const sourceOf = (site) =>
        sources.find((s) => s.url.includes(site === 'djinni' ? 'djinni.co' : 'dou.ua')) ?? sources[0]
    const jobs = Object.fromEntries(
        JOBS.map(([site, title, company, hours, description], i) => {
            const url =
                site === 'djinni'
                    ? `https://djinni.co/jobs/90000${i}/`
                    : `https://jobs.dou.ua/companies/example/vacancies/90000${i}/`
            return [
                url,
                {
                    id: url,
                    title,
                    company,
                    url,
                    description,
                    publishedAt: hoursAgo(hours),
                    sourceIds: [sourceOf(site).id],
                    firstSeen: hoursAgo(hours),
                    score: 0,
                    reasons: [],
                    status: i === 3 ? 'seen' : 'new',
                    pageChecked: true,
                },
            ]
        }),
    )
    const lastRun = {
        at: hoursAgo(0.3),
        newRelevant: 3,
        results: sources.map((s) => ({ sourceId: s.id, name: s.name, ok: true, count: 12 })),
    }
    await wizard.run(
        `chrome.storage.local.set({ jobs: ${JSON.stringify(jobs)}, lastRun: ${JSON.stringify(lastRun)} }).then(() => chrome.runtime.sendMessage({ type: 'settings-changed' })).then(() => location.reload())`,
    )
    await sleep(1500)
    await wizard.shot(n(4, 'filters'))
    await wizard.close()

    const report = await tab(extUrl('report.html'))
    await report.shot(n(1, 'report'))
    await report.close()

    // 3. The popup on a careers page: the page and the popup, put together as the browser shows them
    const page = await tab(JOB_URL)
    const pageShot = await page.shot()
    const helper = await tab(extUrl('options.html'))
    const tabId = await helper.run(`chrome.tabs.query({ url: 'http://${JOB_HOST}/*' }).then(([t]) => t.id)`)
    await helper.close()
    const popup = await tab(extUrl('popup.html'), {
        width: 400,
        height: 800,
        init: `(() => { const query = chrome.tabs.query.bind(chrome.tabs); chrome.tabs.query = (q) => (q && q.active ? Promise.resolve([{ id: ${tabId}, url: '${JOB_URL}' }]) : query(q)) })()`,
    })
    await sleep(1000)
    const height = await popup.run(`Math.ceil(document.body.getBoundingClientRect().height)`)
    const popupShot = await popup.shot(null, { x: 0, y: 0, width: 400, height })
    await popup.close()
    await page.close()
    tiles.set(
        `/tile/popup-${locale}`,
        `<!doctype html><style>body{margin:0;width:${W}px;height:${H}px;overflow:hidden;position:relative}#page{position:absolute;inset:0}#popup{position:absolute;top:8px;right:24px;border-radius:10px;box-shadow:0 12px 40px #0006,0 0 0 1px #0002}</style>
<img id="page" src="data:image/png;base64,${pageShot}"><img id="popup" src="data:image/png;base64,${popupShot}">`,
    )
    const composite = await tab(`http://127.0.0.1:${PORT}/tile/popup-${locale}`)
    await composite.shot(n(3, 'rate-any-job-page'))
    await composite.close()
}

// 4. Promo tiles: the small one (440×280, required) and the marquee (1400×560, optional)
const icon = readFileSync('public/icon.png').toString('base64')
const TAGLINE = {
    // No site names: the images outlive the list of sources
    uk: ['IT Job Radar', 'IT-вакансії, оцінені за твоїм CV'],
    en: ['IT Job Radar', 'IT jobs, scored against your CV'],
}
for (const locale of ['uk', 'en']) {
    for (const [name, w, h, iconSize, title, sub] of [
        ['promo-small', 440, 280, 92, 34, 17],
        ['promo-marquee', 1400, 560, 200, 76, 34],
    ]) {
        tiles.set(
            `/tile/${name}-${locale}`,
            `<!doctype html><meta charset="utf-8"><style>body{margin:0;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;gap:${w / 18}px;background:radial-gradient(circle at 25% 40%,#1f3b33,#121614 70%);font-family:-apple-system,system-ui,sans-serif;color:#eef2ee;overflow:hidden}img{width:${iconSize}px;height:${iconSize}px;border-radius:50%;box-shadow:0 0 0 ${iconSize / 16}px #2f7d4f55,0 10px 40px #0008}h1{margin:0;font-size:${title}px;letter-spacing:-.02em}p{margin:${sub / 3}px 0 0;font-size:${sub}px;color:#b5c7bb;max-width:${w * 0.52}px;line-height:1.3}</style>
<img src="data:image/png;base64,${icon}"><div><h1>${TAGLINE[locale][0]}</h1><p>${TAGLINE[locale][1]}</p></div>`,
        )
        const t = await tab(`http://127.0.0.1:${PORT}/tile/${name}-${locale}`, { width: w, height: h })
        await t.shot(`${locale}-${name}.png`)
        await t.close()
    }
}

chrome.kill()
await new Promise((r) => chrome.once('exit', r))
server.close()
rmSync(ext, { recursive: true, force: true })
rmSync(profile, { recursive: true, force: true })
rmSync(cvPath, { force: true })
console.log(`  ${OUT}`)

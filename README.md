# IT Job Radar

A Chrome extension (Manifest V3) that collects job listings from the Djinni and DOU RSS feeds every few hours, scores each one against your profile, and shows a report sorted into tabs: **Apply**, **Maybe**, **Saved**, **Applied** and **Hidden**. It can also send relevant new jobs to a Telegram bot.

The interface is in Ukrainian and English: it follows the browser's language (Ukrainian for a Ukrainian or Russian browser, English otherwise) and can be switched on the settings page (**Interface language**).

## Install

1. `npm i && npm run release`. The build appears in `extensions/job-radar-<version>/`.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select that folder.
3. A setup page opens. Upload your CV as a PDF (or set things up by hand), answer a few questions and pick the job feeds (see below).
4. Click the extension icon, then **Відкрити звіт** (Open report).

The manifest has a fixed `key`, so every build has the same extension ID (`ncincnjejoopponbjalpajmpmibdmhel`) and the report is always at `chrome-extension://ncincnjejoopponbjalpajmpmibdmhel/report.html`. Loading a newer release folder replaces the old one and keeps your settings and jobs. For day-to-day development, load `dist/` once and press ⟳ on the extension card after `npm run build`. `npm run zip` leaves the key out, because the Chrome Web Store assigns its own ID.

## Privacy

The CV is read in the browser and not stored; settings and jobs stay in this browser's local storage; requests go only to djinni.co, jobs.dou.ua and, if you connect a bot, api.telegram.org. See [PRIVACY.md](PRIVACY.md).

**Settings → General → Backup** saves your settings and the jobs you saved or applied to into a JSON file, and restores them on another computer or after reinstalling. The file contains your Telegram bot token, so keep it to yourself.

If something isn't working, **Settings → General → Copy diagnostics** puts a short technical report (version, sources, schedule, the last refresh and its errors) on the clipboard for a bug report. It doesn't include your Telegram token, rules or jobs.

To keep the requests polite (they come from your IP), at most 10 feeds can be enabled, and the refresh interval is at least 2 hours.

## Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Send your bot `/start`.
3. On the settings page, paste the token, click **Знайти chat id** (Find chat id), then **Тестове повідомлення** (Test message).

Each job comes with buttons: **Зберегти** (Save), **Подав** (Applied) and **Сховати** (Hide) set its status in the report, and the message shows the new status. Telegram can't reach an extension, so it works while the browser is open: the extension keeps asking Telegram for button presses (a request that waits up to 25 seconds for one). Presses made while the computer is off are applied when the browser starts, if that's within 24 hours.

The token is stored only in this browser's `chrome.storage.local`.

## Setup from your CV

On first install (and later from **Налаштування → Фільтри → Згенерувати з CV**), a 4-step wizard builds the scoring rules and picks the feeds. Without a CV, choose **Без CV — налаштувати вручну** and pick the same things by hand:

1. **CV.** Upload a PDF. It's parsed in the browser with pdf.js and isn't sent anywhere or stored. Scanned PDFs without a text layer can't be read.
2. **Technologies.** Known technologies found in the CV are listed with a relevance score: 60% recency (the latest job counts 1, the one before (n−1)/n, …) and 40% frequency (the share of jobs that mention it). The CV is split into jobs at date ranges such as `Mar 2022 – Present`, `03.2019 - 02.2022` or `2016 — 2019`, and at section headings like Skills and Education. A technology the CV names only once counts half, since it's more likely a side tool than your stack. The suggested weight is proportional to relevance, 1–20, and you can change it or untick a technology. Technologies not in the CV can be marked as wanted (added with +5, editable) or unwanted (−12). Without a CV, the technologies you mark as wanted make up your stack, at +12 each by default.
3. **Preferences.** Direction (frontend, backend or mobile, guessed from the CV) and level (guessed from years of experience), roles above senior (Team Lead, Tech Lead, Staff/Principal), spoken languages with a CEFR level (read from the CV when it states them; jobs asking for a higher level, or for a language you don't speak, get −20, while a range that includes yours, like B2–C1, doesn't), whether you want to work with AI coding tools (jobs mentioning Claude Code, Codex, Cursor, Copilot, AI-first or AI-assisted development get +10), work formats (remote, hybrid, office, relocation, plus a city, matched in Ukrainian and English spellings; "2 days remote a week" or "3 days in the office" counts as hybrid, not remote; an office or hybrid job gets its bonus only in your city, and one elsewhere with no remote option gets −20), company type, and whether full-stack roles are fine when the other half of the stack is one you allow.
4. **Sources.** Choose the sites to search (Djinni, DOU); each ticked site opens the feeds suggested for your stack, using the sites' own categories: Djinni's (`React.js`, `Golang`, `.NET`…) and DOU's (`Front End`, `Golang`…, or a text search for frameworks DOU has no category for, like React). Djinni feeds only ask for jobs within your experience: from your level's start (a senior isn't shown internships) to a year more than your CV shows. The first two per site are ticked. Your own feeds go in a separate block: set up any search on djinni.co or jobs.dou.ua (category, experience, remote…) and paste the address of the results page. It's converted to the RSS feed and checked once.

The result replaces the rules on the **Фільтри** (Filters) tab and the feeds on the **Джерела** (Sources) tab, where they stay editable. Running the wizard again starts over: the old rules and feeds are replaced, and the jobs found so far are removed, except the ones you saved or applied to. There are no built-in rules or sources: until you run the wizard (or add them by hand), nothing is collected, every job stays at the base score, and the report shows a notice with a link to the wizard.

Djinni's category filter is case-sensitive, and a value it doesn't know is silently ignored: the feed then returns the latest jobs from every category. A pasted or typed Djinni feed with such a value gets a warning. Copying the address from the site avoids it.

## Rate the job in your tab

Click the extension icon on any job page (LinkedIn, Work.ua, Robota.ua, a company's careers page) to score it with your profile: the score, the reasons, salary and age. **Зберегти** (Save) or **Подав ✓** (Applied) adds it to the report next to the Djinni and DOU jobs. The popup also opens the report and the settings.

The extension reads only the page you have open, and only when you click: it uses `activeTab`, makes no requests to the site and needs no permission for it. That's why LinkedIn, Work.ua and Robota.ua aren't collected automatically: LinkedIn forbids it, and the other two block automated requests with Cloudflare.

The job is read from the page's schema.org JobPosting data (most job sites have it), from the known layouts of LinkedIn, DOU, Work.ua and Robota.ua (title, company, city, salary and the description without the sidebars), or, if you select the description before clicking, from the selection. Failing all that it scores the whole page text and says so, since menus and other jobs can get in.

## How scoring works

Every job starts at 20 points. Each matching regex rule adds or subtracts its weight (for example `+20 React`, `+15 Remote`, `−40 Junior`), and the result is clamped to 0–100. Some rules check only the title, and a rule can have an exception (`unless`). For example, a full-stack title gets `−30` unless the job mentions .NET or C#.

A title without a level (no junior, middle, senior, lead, staff or principal) is scored as middle, unless the description asks for 5+ years of experience.

Matching technologies together add at most 30 points (configurable). Otherwise a junior or middle job that uses your whole stack would still reach 100, because level, role and format would stop mattering.

Known technologies that none of your rules mention count against a job, because it's probably built on another stack. Each one in the title gives `−15`. In the description, `−8` each (up to 5) applies only to frontend, backend or mobile techs from a category you have no rewarded tech in. A frontend developer isn't penalized for Webpack or SCSS, or for Docker or AWS, but is for Spring or Kafka. A rule with weight 0 marks a tech as neutral: no bonus and no penalty. Both penalties are set on the **Фільтри** (Filters) tab.

Jobs at or above the apply threshold (60 by default) go to **Apply**, jobs below the hide threshold (25) are hidden, and the rest go to **Maybe**.

Only recent jobs count: anything published more than 3 days ago (configurable, 1–45) is treated as stale. By then the candidate pipeline is usually full. Stale jobs move to **Hidden** and are left out of the badge, notifications and Telegram. Saved and applied jobs always stay in their tabs.

The salary, when a job states one, is shown next to the company: Djinni puts it at the start of the description, DOU in the title, and some descriptions have a rate like "Up to $20/hour". Set a minimum ($/month) in the wizard or on the settings page, and jobs whose upper bound is lower move to **Hidden**. Jobs without a salary, or with only "from X", stay. Hourly rates count as 160 hours a month, and EUR and UAH use rough fixed rates.

The report can be narrowed to one site (**Усі / Djinni / DOU**). The same job posted on both sites is shown once, marked «Djinni / DOU», and clicking its title asks which site to open. Jobs saved from the popup show under **Усі**, marked with their site (LinkedIn, Work.ua, Robota.ua…). Each card shows the score's reasons in green and red, and, as plain chips, the known technologies the job mentions that didn't change its score (for example Docker or Jest for a frontend profile).

Within each tab, the newest jobs come first. Jobs published at the same time are ordered by score.

You can edit rules, weights, thresholds, the age limit and RSS sources on the settings page (a pasted search page address becomes its feed). Saving rescores every stored job.

Jobs older than 45 days are pruned, and so are jobs whose sources you removed (in the wizard or in settings; a disabled source keeps its jobs). Jobs you saved or applied to always stay.

## Development

```
npm i
npm run build          # bundle into dist/
npm run typecheck      # tsc
npm test               # node:test, one file per area in test/*.test.ts
npx tsx --test test/salary.test.ts                             # one file
npx tsx --test --test-name-pattern="Android" test/*.test.ts     # tests by name
npm run prettierfix    # format (Prettier: 4 spaces, single quotes, no semicolons)
npm run prettiercheck
npm run release        # typecheck + tests, bump patch version, build into extensions/job-radar-<version>/
npm run release -- minor   # same, but bump minor (0.1.9 → 0.2.0); also `-- major`
npm run zip            # zip the current release (for the Chrome Web Store)
```

The version lives in `public/manifest.json`, and `npm run release` bumps it.

## Structure

-   `src/core/`: pure logic with no Chrome APIs, tested in Node
    -   `rss.ts`: RSS parser without `DOMParser` (the service worker doesn't have it)
    -   `normalize.ts`: title, company and location, canonical URL, cross-source dedup key
    -   `scoring.ts` and `defaults.ts`: weighted regex rules and default settings
    -   `feeds.ts`: Djinni and DOU categories, search page → RSS conversion, feeds suggested for a stack
    -   `collect.ts`: merge, rescore and prune
    -   `jobPage.ts`: details from a job page (JSON-LD), used for the Djinni company
    -   `pageJob.ts`: a job read from the page in your tab, for the popup
    -   `techs.ts`: the technology dictionary (name, category, regex)
    -   `cv.ts`: CV text split into jobs and tech relevance
    -   `profile.ts`: wizard answers turned into scoring rules
-   `src/i18n/`: the interface texts, `uk.ts` and `en.ts`
-   `src/services/`: `storage.ts` (`chrome.storage`), `telegram.ts` (Bot API) and `pdf.ts` (pdf.js text extraction)
-   `src/pages/`: Preact UI with `report.tsx`, `options.tsx`, `onboarding.tsx` (setup wizard, from a CV or by hand), `popup.tsx` (the job in your tab), `components/` and `hooks/useStorage.ts`
-   `src/background.ts`: service worker for the alarm schedule, fetching, badge and notifications
-   `public/`: manifest, HTML shells, `styles.css` and the icon, copied into the build as is

## Known issues

-   The Djinni RSS feed has no company field, so the extension reads it from the job page instead, for sources marked **перевіряти сторінку** (check page) in settings. It's turned on for every Djinni feed the wizard or a pasted link adds. It checks up to 20 fresh jobs per refresh, so after the first install some companies appear only after the next refresh. Dedup with the same job on DOU starts working once the company is known.
-   The popup relies on how LinkedIn, DOU, Work.ua and Robota.ua lay out a job page. When a site changes its layout, the popup falls back to the page text with a warning; selecting the description before clicking always works.

## Ideas

-   Optional LLM scoring (your own API key) with a short "why this fits or doesn't" note
-   Save and hide buttons in Telegram that sync with the report

## License

MIT, see [LICENSE](LICENSE).

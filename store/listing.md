# Chrome Web Store listing

What to paste into the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). The name and the short description come from `public/_locales/*/messages.json` (the manifest); the rest is entered in the dashboard. Images are in `store/images/`, made by `node store/screenshots.mjs` after `npm run build`.

Default language: English. Add Ukrainian as a second language with the `uk` texts and images.

## Store listing

**Category:** Workflow & Planning (Productivity)

**Language:** English, Ukrainian

### Detailed description — English

```
IT Job Radar finds IT jobs that fit you and tells you where it's worth applying.

Upload your CV once. The extension reads it right in the browser (it is never uploaded or stored), finds your technologies, how recently you used each one, your level and languages, and turns them into scoring rules you can see and edit. Then it checks the Djinni and DOU job feeds for your stack every few hours and scores every new job from 0 to 100.

WHAT YOU GET
• A report sorted into Apply, Maybe, Saved, Applied and Hidden, with the reasons behind each score: "+20 React", "+15 Remote", "−25 Middle", "−40 Junior"
• Sorting by date or by score, a search box and a Djinni / DOU switch
• Job feeds picked for your stack and experience, or your own: paste any search from djinni.co or jobs.dou.ua
• Rate any job page in one click: LinkedIn, Work.ua, Robota.ua or a company's careers page. Save it to the report next to the others
• Optional Telegram bot: new matching jobs arrive with Save, Applied and Hide buttons
• Salary shown and filtered by your minimum; old postings moved out of the way
• Backup and restore of your settings and saved jobs
• Ukrainian and English interface

PRIVATE BY DESIGN
No account, no server, no analytics. Your CV is read once in the browser and discarded. Settings and jobs stay in your browser. The extension only talks to djinni.co and jobs.dou.ua (without cookies, a few requests every few hours) and, if you connect it, to your own Telegram bot. It reads the page in your tab only when you click its button.

Open source: https://github.com/Bezvra/job-radar
```

### Detailed description — Ukrainian

```
IT Job Radar знаходить IT-вакансії, які тобі підходять, і показує, куди варто подаватись.

Завантаж CV один раз. Розширення прочитає його прямо в браузері (воно нікуди не надсилається і не зберігається), знайде твої технології, наскільки нещодавно ти з ними працював, рівень і мови, і складе з них правила оцінки, які можна переглянути й змінити. Далі воно кожні кілька годин перевіряє фіди вакансій Djinni та DOU для твого стеку й оцінює кожну нову вакансію від 0 до 100.

ЩО ТИ ОТРИМУЄШ
• Звіт із вкладками «Подавайся», «Можливо», «Збережені», «Подав» і «Сховані» та причинами кожного балу: «+20 React», «+15 Remote», «−25 Middle», «−40 Junior»
• Сортування за датою чи балом, пошук і перемикач Djinni / DOU
• Фіди, підібрані під твій стек і досвід, або свої: встав будь-який пошук з djinni.co чи jobs.dou.ua
• Оцінка будь-якої сторінки вакансії в один клік: LinkedIn, Work.ua, Robota.ua або сторінка кар'єри компанії. Збережи її у звіт поряд з іншими
• Telegram-бот за бажанням: нові відповідні вакансії приходять з кнопками «Зберегти», «Подав» і «Сховати»
• Зарплата у вакансії і фільтр за твоїм мінімумом; старі вакансії не заважають
• Резервна копія налаштувань і збережених вакансій
• Інтерфейс українською та англійською

ПРИВАТНІСТЬ
Без акаунта, сервера й аналітики. CV читається один раз у браузері й не зберігається. Налаштування й вакансії лишаються у твоєму браузері. Розширення звертається лише до djinni.co та jobs.dou.ua (без cookies, кілька запитів раз на кілька годин) і, якщо підключиш, до твого власного Telegram-бота. Сторінку у вкладці воно читає лише після натискання на його кнопку.

Відкритий код: https://github.com/Bezvra/job-radar
```

### Images

| Field                                   | English                                                                                       | Ukrainian                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Screenshots (1280×800), in this order   | `en-1-report.png`, `en-2-setup-from-cv.png`, `en-3-rate-any-job-page.png`, `en-4-filters.png` | `uk-1-report.png`, `uk-2-setup-from-cv.png`, `uk-3-rate-any-job-page.png`, `uk-4-filters.png` |
| Small promo tile (440×280)              | `en-promo-small.png`                                                                          | `uk-promo-small.png`                                                                          |
| Marquee promo tile (1400×560, optional) | `en-promo-marquee.png`                                                                        | `uk-promo-marquee.png`                                                                        |

The store icon (128×128) comes from the package (`public/icon.png`).

**Official URL / homepage:** https://github.com/Bezvra/job-radar
**Support URL:** https://github.com/Bezvra/job-radar/issues

## Privacy practices

**Single purpose:**

```
Find IT jobs that fit the user: collect job listings from Djinni and DOU job feeds, score them against the user's profile built from their CV, and show them in a report (optionally in the user's own Telegram bot); the user can also score the job page open in the current tab.
```

**Permission justifications:**

| Permission                                   | Justification                                                                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                    | Keeps the user's settings (scoring rules, chosen job feeds, thresholds, optional Telegram bot token) and the collected jobs with their statuses in the browser's local storage. Nothing is stored outside the browser.  |
| `alarms`                                     | Checks the user's job feeds on the schedule they set (every 2 hours or less often), and while the user has connected a Telegram bot, restarts the check for its button presses if the browser stopped it.               |
| `notifications`                              | Shows a notification when new jobs matching the user's profile are found. Can be turned off in the settings.                                                                                                            |
| `activeTab`                                  | When the user clicks the extension's toolbar button, it reads the job page open in that tab (title, company, description) to score it against the user's profile. Nothing is read without that click.                   |
| `scripting`                                  | Used together with activeTab, only after the user's click: runs a function in the current tab that returns the job's title, company and description from the page, so the popup can score it.                           |
| Host permission `https://djinni.co/*`        | Downloads the RSS job feeds the user chose on djinni.co, and the job pages of new Djinni jobs to read the company name, which the feed lacks. Requests carry no cookies; at most 10 feeds and 20 job pages per refresh. |
| Host permission `https://jobs.dou.ua/*`      | Downloads the RSS job feeds the user chose on jobs.dou.ua. Requests carry no cookies.                                                                                                                                   |
| Host permission `https://api.telegram.org/*` | Only if the user connects their own Telegram bot: sends new matching jobs to it and reads presses of the job buttons (Save, Applied, Hide) from the user's own chat.                                                    |

**Remote code:** No, I am not using remote code. (Everything, pdf.js included, is bundled in the package.)

**Data usage** — what to tick: _Website content_ (the job page in the current tab is read when the user clicks the button; a saved job is kept in local storage). Nothing is sent to the developer or third parties; the only outgoing data is the user's own choice to send jobs to their own Telegram bot. The CV is read in the browser and discarded, never stored or transmitted, so it isn't "collected". Then certify all three statements: not sold to third parties, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/Bezvra/job-radar/blob/main/PRIVACY.md

## Upload

`npm run release` (or `npm run release -- minor`), then `npm run zip` → `extensions/job-radar-<version>.zip` (the manifest's `key` is removed; the store assigns its own ID).

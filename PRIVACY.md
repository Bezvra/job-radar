# IT Job Radar — Privacy Policy

_Last updated: 29 October 2026_

IT Job Radar is a browser extension that collects job listings from Djinni and DOU, scores them against your profile and shows them in a report. It has no server of its own and no analytics: the developer receives no data from it.

## What stays on your device

-   **Your CV.** The PDF you upload in the setup wizard is read in the browser (pdf.js). The text is used once to suggest technologies, a level and spoken languages, and is then discarded. Neither the file nor its text is stored or sent anywhere.
-   **Settings.** Scoring rules, job feeds, thresholds, the city and work formats you chose, the minimum salary, the interface language and, if you set one up, your Telegram bot token and chat id. They are kept in the extension's local storage (`chrome.storage.local`) in this browser profile.
-   **Jobs.** The listings found, their scores and the statuses you set (saved, applied, hidden), also in local storage. Jobs older than 45 days are removed, except the ones you saved or applied to.

Removing the extension deletes all of it.

## What the extension sends, and where

-   **djinni.co and jobs.dou.ua.** On a schedule (every few hours, as set in the settings), the extension downloads the RSS feeds you chose and, for some Djinni jobs, the job page to read the company name. When you paste a search address in the setup wizard, the feed is downloaded once to count its jobs. These are plain requests without cookies: the sites don't learn who you are, and nothing about you or your CV is included.
-   **api.telegram.org**, only if you connect a Telegram bot. The extension sends new matching jobs (title, company, salary, score and link) to your own bot with the token you provided, and reads the bot's updates once to find your chat id.

Nothing is sent to any other address.

## The page in your tab

When you click the extension's icon, it reads the page open in that tab (the job title, company and description) to score it. This happens only on your click, uses Chrome's `activeTab` permission and makes no requests to that site. The result is kept only if you click Save or Applied.

## Permissions

-   `storage`: keep your settings and jobs in this browser.
-   `alarms`: check the feeds on the schedule you set.
-   `notifications`: tell you about new matching jobs (can be turned off).
-   `activeTab` and `scripting`: read the job in your current tab when you click the icon.
-   Access to `djinni.co`, `jobs.dou.ua` and `api.telegram.org`: download the feeds and job pages, and send jobs to your Telegram bot.

## Contact

Questions about this policy: open an issue in the project's repository.

---

# Політика конфіденційності

IT Job Radar — розширення для браузера, яке збирає вакансії з Djinni та DOU, оцінює їх за вашим профілем і показує у звіті. У нього немає власного сервера й аналітики: розробник не отримує від нього жодних даних.

**На вашому пристрої:** CV (PDF) читається в браузері, використовується один раз для підказок і не зберігається та нікуди не надсилається. Налаштування (правила, джерела, місто, формати, мінімальна зарплата, мова, токен Telegram-бота) і знайдені вакансії зберігаються лише в локальному сховищі розширення в цьому профілі браузера. Видалення розширення видаляє все.

**Що надсилається:** запити без cookies до djinni.co і jobs.dou.ua за розкладом (RSS-фіди та сторінки вакансій Djinni, щоб дізнатися компанію), і — лише якщо ви підключили бота — нові відповідні вакансії до вашого Telegram-бота через api.telegram.org. Більше нікуди.

**Сторінка у вкладці:** після кліку на іконку розширення читає відкриту сторінку вакансії, щоб її оцінити, без запитів до цього сайту. Результат зберігається, лише якщо ви натиснете «Зберегти» або «Подав».

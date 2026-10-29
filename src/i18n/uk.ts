import type { ComponentChildren } from 'preact'

/** Wraps a piece of a message in an element: a link, a chip, <code>… */
type Wrap = (text: string) => ComponentChildren

const LANGUAGE_NAMES = {
    en: 'Англійська',
    uk: 'Українська',
    de: 'Німецька',
    pl: 'Польська',
    fr: 'Французька',
    es: 'Іспанська',
}

/**
 * The Ukrainian UI, and the shape every other language follows (see Messages). Functions take what varies; those
 * returning ComponentChildren get the markup to wrap parts in, so a sentence with a link stays one message
 */
export const uk = {
    common: {
        save: 'Зберегти',
        applied: 'Подав ✓',
        hide: 'Сховати',
        restore: 'Повернути',
        settings: 'Налаштування',
        remove: 'Видалити',
        cancel: 'Скасувати',
        error: (message: string) => `Помилка: ${message}`,
        score: 'Бал відповідності',
        neutralTech: 'Є у вакансії, на бал не впливає',
        notImportant: 'не важливо',
    },
    ago: {
        now: 'щойно',
        hours: (h: number) => `${h} год тому`,
        days: (d: number) => `${d} дн тому`,
    },
    languages: LANGUAGE_NAMES,
    locale: {
        label: 'Мова інтерфейсу',
        auto: 'Як у браузері',
    },

    report: {
        tabs: { apply: 'Подавайся', maybe: 'Можливо', saved: 'Збережені', applied: 'Подав', hidden: 'Сховані' },
        refresh: 'Оновити зараз',
        refreshing: 'Оновлюю…',
        markSeen: (n: number) => `Позначити переглянутими (${n})`,
        noSources: (wizard: Wrap, settings: Wrap) => [
            'Джерел вакансій ще немає. ',
            wizard('Пройди налаштування'),
            ' — запропонуємо фіди Djinni й DOU під твій стек, — або додай свої в ',
            settings('налаштуваннях'),
            '.',
        ],
        noRules: (wizard: Wrap, settings: Wrap) => [
            'Фільтрів ще немає, тому вакансії не оцінюються. ',
            wizard('Завантаж CV'),
            ', щоб їх згенерувати, або додай правила в ',
            settings('налаштуваннях'),
            '.',
        ],
        search: 'Фільтр за назвою, компанією, текстом…',
        sort: 'Сортування',
        sorts: { newest: 'Новіші', score: 'За балом' },
        platform: 'Платформа',
        all: 'Усі',
        empty: 'Тут порожньо.',
        firstRun: 'Натисни «Оновити зараз», щоб зібрати перші вакансії.',
    },
    run: {
        never: 'Ще не оновлювалось',
        done: (ago: string, total: number) => `Оновлено ${ago} · ${total} позицій у фідах`,
        emptyFeed: 'Фід порожній або формат змінився',
    },
    card: {
        new: 'нова',
        newTitle: 'Ще не відкривав. Зникне, коли відкриєш вакансію або зміниш статус',
        salary: 'Зарплата з вакансії',
        underpaid: (min: number) => `Нижче бажаної зарплати ($${min}/міс)`,
        chooser: 'Вакансія є на кількох сайтах. Де відкрити?',
    },
    popup: {
        reading: 'Читаю сторінку…',
        openJobPage: 'Відкрий сторінку вакансії (LinkedIn, Work.ua, сайт компанії…) і натисни на іконку ще раз.',
        noJob: 'На цій сторінці не знайшлося тексту вакансії.',
        blocked: 'Цю сторінку браузер не дає прочитати розширенням (наприклад, Chrome Web Store).',
        verdict: { good: 'Варто подаватись', mid: 'Можливо', bad: 'Слабкий збіг' },
        noRules: (wizard: Wrap) => ['Фільтрів ще немає, тож оцінювати нема чим. ', wizard('Налаштуй профіль'), '.'],
        guessed:
            'Опису вакансії не знайшлося, тому оцінено весь текст сторінки — там може бути зайве. Для точності виділи опис і натисни на іконку ще раз.',
        stale: (days: number) => `Старша за ${days} дн — у звіті така пішла б у «Сховані».`,
        underpaid: (min: number) => `Нижче бажаної зарплати ($${min}/міс).`,
        inReport: (tab: string) => `Уже у звіті: «${tab}»`,
        openReport: (n: number) => `Відкрити звіт${n ? ` (${n} нових)` : ''}`,
    },
    notify: {
        newJobs: (n: number) => `Нових релевантних вакансій: ${n}`,
    },
    telegram: {
        buttons: {
            saved: (on: boolean): string => (on ? '✓ Збережено' : '💾 Зберегти'),
            applied: (on: boolean): string => (on ? '✓ Подав' : '📨 Подав'),
            hidden: (on: boolean): string => (on ? '✓ Сховано' : '🙈 Сховати'),
        },
        done: { saved: 'Збережено у звіті ✓', applied: 'Позначено «Подав» ✓', hidden: 'Сховано ✓' },
        gone: 'Цієї вакансії вже немає у звіті.',
        buttonsHint: 'Кнопки спрацюють, коли на комп’ютері відкритий браузер з IT Job Radar.',
        open: 'Відкрити вакансію',
        more: (n: number) => `…і ще ${n} у звіті розширення.`,
        connected: 'IT Job Radar підключено ✅',
    },

    feedback: {
        bug: 'Повідомити про проблему',
        idea: 'Запропонувати ідею',
    },

    options: {
        title: 'Налаштування',
        back: '← До звіту',
        saved: 'Збережено, вакансії перераховано ✓',
        reset: 'Скинути до стандартних',
        resetConfirm: 'Скинути всі налаштування?',
        tabs: { general: 'Загальні', sources: 'Джерела', filters: 'Фільтри' },
        sourceRow: (i: number, name: string, problem: string) => `джерело ${i} «${name}»: ${problem}`,
        tooManySources: (max: number) =>
            `увімкнено забагато джерел, максимум ${max}: кожне завантажується при кожному оновленні, і сайт може заблокувати часті запити. Вимкни або видали зайві.`,
        ruleRow: (i: number, name: string, problem: string) => `правило ${i} «${name}»: ${problem}`,
        general: 'Загальне',
        applyFrom: '«Подавайся» від балу',
        hideBelow: 'Ховати нижче балу',
        maxAge: 'Не старші ніж, днів',
        minSalary: 'Зарплата від, $/міс',
        interval: 'Інтервал оновлення, год',
        generalHint:
            'Старіші вакансії та ті, де верхня межа зарплати нижча за бажану, не потрапляють у «Подавайся» й «Можливо», не надсилаються в Telegram і лежать у «Сховані». Вакансії без зарплати показуються. Погодинна ставка рахується як ×160 год, гривні та євро — за приблизним курсом. Збережені та ті, куди подав, лишаються завжди.',
        notify: 'Сповіщення Chrome про нові релевантні вакансії',
        tgSend: 'Надсилати релевантні вакансії в Telegram',
        tgToken: 'Токен бота (від @BotFather)',
        tgChatPlaceholder: 'напр. 123456789',
        tgHint: 'Напиши своєму боту будь-яке повідомлення, потім натисни «Знайти chat id». Токен зберігається лише в цьому браузері.',
        tgFind: 'Знайти chat id',
        tgTest: 'Тестове повідомлення',
        tgNoToken: 'Спершу встав токен бота.',
        tgNoChat: 'Повідомлень не знайдено. Напиши боту /start і спробуй ще раз.',
        tgFound: (name: string, id: string) => `Знайдено: ${name} (${id}). Натисни «Зберегти».`,
        tgSent: 'Надіслано, перевір Telegram ✓',
        backup: 'Резервна копія',
        backupHint:
            'Файл з усіма налаштуваннями (правила, джерела, Telegram), збереженими вакансіями й тими, куди подав. Знадобиться для іншого комп’ютера чи після перевстановлення. У ньому є токен Telegram-бота, тож не публікуй його.',
        exportFile: 'Зберегти у файл',
        importFile: 'Відновити з файлу',
        importConfirm: (jobs: number) =>
            `Замінити поточні налаштування налаштуваннями з файлу і додати збережені вакансії (${jobs})?`,
        badBackup: 'Це не файл резервної копії IT Job Radar.',
        diagnostics: 'Проблема чи ідея',
        diagnosticsHint:
            'Щось не працює чи є ідея — напиши на GitHub. До повідомлення про проблему діагностика додається сама: версія, джерела, розклад, останнє оновлення з помилками й кількість вакансій. Без токена Telegram, правил і текстів вакансій.',
        copyDiagnostics: 'Скопіювати діагностику',
        copied: 'Скопійовано ✓',
        sourcesTitle: 'Джерела (RSS)',
        sourcesHint: (code: Wrap) => [
            'Налаштуй пошук на Djinni або DOU і встав адресу сторінки з результатами — її буде перетворено на RSS. На Djinni категорії чутливі до регістру: ',
            code('primary_keyword=React'),
            ' мовчки ігнорується (фід віддає всі вакансії підряд), а ',
            code('React.js'),
            ' працює.',
        ],
        techs: 'Технології',
        techCap: 'Максимум плюсів за технології',
        unlistedTitle: 'За технологію в назві вакансії',
        unlistedDescription: 'За технологію в описі (до 5 штук)',
        techsHint:
            'Максимум — скільки балів разом можуть дати всі твої технології, щоб вакансія з усім твоїм стеком, але не того рівня (junior, middle) чи формату, не набирала 100. Штрафи — за відомі технології, для яких у тебе немає жодного правила нижче: вакансія, найпевніше, на іншому стеку. В описі рахуються лише frontend/backend/mobile — Docker, AWS, Jest тощо там звичайне оточення. Щоб технологія не штрафувалась і не давала плюсу, додай для неї правило з вагою 0. 0 у цих полях вимикає штраф.',
        rules: 'Правила скорингу',
        fromCv: 'Згенерувати з CV',
        rulesHint:
            'Кожна вакансія стартує з 20 балів, кожне правило, що спрацювало, додає свою вагу (межі 0–100). Вираз — регулярний, без урахування регістру, шукається в назві й описі (або лише в назві). «Крім випадків» — вираз-виняток: якщо він є в тексті, правило не спрацьовує. Після збереження всі вакансії перераховуються.',
    },
    sources: {
        noName: 'Вкажи назву',
        badUrl: 'Некоректне посилання',
        onlyHosts: (hosts: string) => `Підтримуються лише ${hosts}`,
        unknownDjinni: (keys: string) =>
            `Djinni не знає категорії ${keys}: фід, схоже, віддаватиме всі вакансії підряд. Скопіюй посилання з пошуку на сайті.`,
        enabled: 'Увімкнено',
        namePlaceholder: 'Назва, напр. Djinni · React',
        urlPlaceholder: 'https://djinni.co/jobs/?… або jobs.dou.ua/vacancies/?…',
        checkPage: 'перевіряти сторінку',
        checkPageTitle:
            'Відкривати сторінку кожної нової свіжої вакансії й брати звідти дані, яких немає в RSS (зараз — компанію; для Djinni потрібно)',
        add: '+ Додати джерело',
    },
    rulesEditor: {
        noName: 'Вкажи назву',
        noPattern: 'Вкажи вираз',
        badWeight: 'Вага має бути числом',
        badRegex: (message: string) => `Помилка у виразі: ${message}`,
        weight: 'Вага: плюс або мінус до балу',
        namePlaceholder: 'Назва, напр. React',
        titleOnly: 'лише в назві',
        titleOnlyTitle: 'Шукати лише в назві вакансії',
        patternPlaceholder: 'Регулярний вираз, напр. \\breact\\b',
        unlessPlaceholder: "Крім випадків, коли є… (необов'язково)",
        add: '+ Додати правило',
    },
    feeds: {
        search: (q: string) => `пошук «${q}»`,
        all: 'усі вакансії',
        more: ' + фільтри',
        experience: (from: number, to: number) =>
            `досвід ${from === to ? from : `${from}–${to}`}${to === 10 ? '+' : ''} р.`,
    },
    salary: {
        from: 'від ',
        upTo: 'до ',
        uah: ' грн',
        perHour: '/год',
        perYear: '/рік',
    },

    wizard: {
        pageTitle: 'IT Job Radar — налаштування',
        title: 'Налаштуймо IT Job Radar під тебе',
        intro: 'З CV (або вручну) і кількох відповідей зберемо фільтри й джерела вакансій; їх завжди можна змінити в налаштуваннях.',
        steps: { upload: '1. CV', techs: '2. Технології', prefs: '3. Побажання', sources: '4. Джерела' },
        back: '← Назад',
        next: 'Далі →',
        replaceNote: 'Правила й джерела буде замінено, а знайдені вакансії — видалено (крім збережених і поданих).',
        noTechsInCv: 'У CV не знайшлося жодної знайомої технології. Можна налаштувати вручну.',
        pickATech: 'Познач хоча б одну технологію, з якою працюєш.',
        badWeight: (tech: string) => `Вага для ${tech} має бути числом.`,
        pickASource: 'Обери хоча б одне джерело, інакше вакансій не буде.',
        tooManySources: (max: number) =>
            `Обрано забагато джерел, максимум ${max}: кожне завантажується при кожному оновленні, і сайт може заблокувати часті запити.`,
    },
    upload: {
        legend: 'Твоє CV',
        needPdf: 'Потрібен файл PDF.',
        scan: 'У цьому PDF немає тексту — схоже, це скан. Збережи CV як PDF з текстом (напр. з Google Docs).',
        unreadable: (message: string) => `Не вдалося прочитати PDF: ${message}`,
        reading: 'Читаю CV…',
        drop: 'Обери або перетягни PDF',
        dropHint:
            'Знайдемо в ньому технології й оцінимо, наскільки кожна актуальна для тебе. CV обробляється в браузері й нікуди не надсилається та не зберігається.',
        manual: 'Без CV — налаштувати вручну',
        manualTitle: 'Обереш технології й побажання самостійно, на тих самих кроках',
        skip: 'Пропустити',
        skipTitle: 'Поточні фільтри й джерела не зміняться; їх можна додати в налаштуваннях',
    },
    techs: {
        added: 'додано вручну',
        noDates: 'дат у CV не знайдено, оцінка за кількістю згадок',
        skillsOnly: 'лише в списку навичок, без прив’язки до місця роботи',
        lastUsed: (year: number, jobs: number, total: number) => `востаннє ${year} · у ${jobs} з ${total} місць роботи`,
        stack: 'Твій стек',
        found: 'Знайдено в CV',
        stackHint:
            'Познач технології нижче — вони з’являться тут. Вага — бали, які додаються вакансії з цією технологією: дай більше основним, менше другорядним.',
        foundHint:
            'Актуальність = наскільки нещодавно технологія була в роботі (60%) і в скількох місцях роботи траплялась (40%). З неї пропонуємо вагу — бали, які додаються вакансії з цією технологією. Зміни, якщо не згоден, або зніми галочку, щоб не враховувати.',
        relevance: (n: number) => `Актуальність ${n}%`,
        weight: 'Вага: бали до оцінки вакансії',
        all: 'Технології',
        others: 'Інші технології',
        cycleHint: (want: Wrap, avoid: Wrap, title: number, description: number) => [
            'Клік: ',
            want('хочу'),
            ' (додається в стек вище, вагу можна змінити) → ще клік: ',
            avoid('не хочу'),
            ` → ще клік: без позначки. Технології без позначки вважаються чужим стеком: вакансія з ними в назві отримає ${title}, в описі ${description} за кожну (змінюється на вкладці «Фільтри»). Зняті галочки вище — нейтральні: ні плюсу, ні штрафу.`,
        ],
    },
    prefs: {
        role: 'Роль',
        direction: 'Напрям',
        level: 'Рівень',
        above: 'Ролі вище Senior, які розглядаєш',
        aiTools: 'Хочу працювати з AI-інструментами',
        aiHint: (weight: number) =>
            `Вакансії, де згадано Claude Code, Codex, Cursor, Copilot, AI-first чи AI-assisted development, отримають +${weight}. Без позначки нічого не змінюється.`,
        format: 'Формат роботи',
        remote: 'Віддалено',
        hybrid: 'Гібрид',
        office: 'Офіс',
        relocation: 'Релокація',
        relocationHint:
            'Без «Релокації» вакансії з обов’язковим переїздом опускаються (−25); з нею — трохи піднімаються (+5).',
        city: 'Місто',
        cityPlaceholder: 'напр. Одеса',
        cityHint: 'Латинське написання (Odesa, Odessa) додається само. Інші варіанти можна дописати через кому.',
        languages: 'Мови',
        removeLanguage: 'Прибрати',
        addLanguage: '+ Додати мову',
        noLanguages: (weight: number) => `Мов не додано — будь-яка вимога до мови у вакансії дасть ${weight}.`,
        languagesHint: (weight: number) =>
            `Вакансії, що вимагають вищого рівня (напр. «English: C1» при B2) або мову, якої тут немає, отримають ${weight}. Діапазон, що включає твій рівень («B2–C1»), штрафу не дає.`,
        salary: 'Зарплата',
        minSalary: 'Не менше ніж, $/міс',
        salaryHint:
            'Вакансії, де верхня межа зарплати нижча, підуть у «Сховані». Без зарплати або «від …» — показуються. Погодинна ставка рахується як ×160 год.',
        company: 'Компанія',
        companyTypes: { product: 'Продукт / стартап', outsource: 'Аутсорс / аутстаф', any: 'Не важливо' },
        fullstackNo: 'Не розглядаю',
        fullstackYes: 'Розглядаю, якщо інша частина стеку — з дозволених',
        fullstackHint:
            'Full stack вакансії без жодної з позначених технологій отримають −30. Нічого не позначено — штрафу немає.',
    },
    feedsStep: {
        siteHints: {
            djinni: 'Категорії Djinni; компанію беремо зі сторінки вакансії, бо в RSS її немає',
            dou: 'Категорії DOU, а для фреймворків без категорії (React, Vue…) — пошук за назвою',
        },
        needSearchUrl: 'Потрібне посилання на пошук вакансій: djinni.co/jobs/?… або jobs.dou.ua/vacancies/?…',
        unknownDjinni: (keys: string) =>
            `Djinni не знає категорії ${keys}, тож фід віддаватиме всі вакансії підряд. Скопіюй посилання з пошуку на сайті.`,
        count: (n: number) => `Зараз у фіді ${n >= 100 ? 'щонайменше 100' : n} вакансій`,
        checkFailed: (message: string) => `Не вдалося перевірити фід: ${message}`,
        where: 'Де шукати',
        whereHint:
            'Обери сайти — для кожного запропонуємо фіди за твоїм стеком. Кожен фід перевіряється раз на кілька годин; краще кілька точних, ніж багато широких — зайве все одно відсіє оцінка.',
        noSuggestions: (site: string) => `Для твого стеку категорій на ${site} немає — додай свій пошук нижче.`,
        custom: 'Свої джерела',
        customHint: (djinni: Wrap, dou: Wrap) => [
            'Налаштуй пошук на ',
            djinni('Djinni'),
            ' або ',
            dou('DOU'),
            ' (категорія, досвід, віддалено…) і встав сюди адресу сторінки з результатами — зробимо з неї RSS.',
        ],
        checking: 'Перевіряю…',
        add: 'Додати',
    },

    /** Labels of the rules the wizard generates (Rule.labelKey) and of the reasons scoring adds */
    rule: {
        noLevel: () => 'Рівень не вказано (як Middle)',
        aiTools: () => 'AI-інструменти',
        hybrid: () => 'Гібрид',
        hybridIn: (city: string) => `Гібрид: ${city}`,
        office: () => 'Офіс',
        officeIn: (city: string) => `Офіс: ${city}`,
        onlyOffice: () => 'Лише офіс',
        city: (city: string) => `Місто: ${city}`,
        elsewhere: (city: string) => `Офіс/гібрид не в місті ${city}`,
        noRemote: () => 'Офіс/гібрид без віддаленки',
        relocation: () => 'Релокація',
        relocationRequired: () => 'Обов’язкова релокація',
        product: () => 'Продукт/стартап',
        outsource: () => 'Аутсорс/аутстаф',
        fullstackNotWith: (techs: string) => `Full stack не з ${techs}`,
        languageAbove: (id: string, level: string) =>
            `${LANGUAGE_NAMES[id as keyof typeof LANGUAGE_NAMES] ?? id} вище ${level}`,
        languageNone: (id: string) => `${LANGUAGE_NAMES[id as keyof typeof LANGUAGE_NAMES] ?? id} (не володієш)`,
        otherLanguages: (...ids: string[]) =>
            `Інша мова: ${ids.map((id) => (LANGUAGE_NAMES[id as keyof typeof LANGUAGE_NAMES] ?? id).toLowerCase()).join(', ')}`,
    },
    score: {
        notInFilters: (tech: string) => `${tech} — не у фільтрах`,
        otherStack: (techs: string) => `Інший стек: ${techs}`,
        overCap: (cap: number) => `Понад ліміт за технології (${cap})`,
    },
}

export type Messages = typeof uk

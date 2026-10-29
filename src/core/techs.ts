export type TechCategory = 'frontend' | 'backend' | 'mobile' | 'devops' | 'data' | 'qa'

export interface Tech {
    id: string
    name: string
    category: TechCategory
    /** Regex source, case-insensitive. Used both to find the tech in a CV and as the scoring rule pattern. */
    pattern: string
    /** Case-sensitive regex for CVs only, when the rule pattern is too narrow there (e.g. "Go" vs the word "go") */
    cvPattern?: string
}

export const CATEGORY_LABELS: Record<TechCategory, string> = {
    frontend: 'Frontend',
    backend: 'Backend',
    mobile: 'Mobile',
    devops: 'DevOps / Cloud',
    data: 'Data / ML',
    qa: 'QA',
}

const t = (id: string, name: string, category: TechCategory, pattern: string, cvPattern?: string): Tech => ({
    id,
    name,
    category,
    pattern,
    ...(cvPattern && { cvPattern }),
})

// Patterns avoid common false positives: Java vs JavaScript, React vs React Native, .NET vs "example.net",
// Go only as Golang or "Go developer" since "go" is an ordinary word.
export const TECHS: Tech[] = [
    // Frontend
    t('react', 'React', 'frontend', '\\breact(\\.?js)?\\b(?![\\s-]*native)'),
    t('angular', 'Angular', 'frontend', '\\bangular(js)?\\b'),
    t('vue', 'Vue', 'frontend', '\\bvue(\\.?js)?\\b'),
    t('svelte', 'Svelte', 'frontend', '\\bsvelte(kit)?\\b'),
    t('nextjs', 'Next.js', 'frontend', '\\bnext\\.?js\\b'),
    t('nuxt', 'Nuxt', 'frontend', '\\bnuxt(\\.?js)?\\b'),
    t('typescript', 'TypeScript', 'frontend', '\\btypescript\\b'),
    t('javascript', 'JavaScript', 'frontend', '\\bjavascript\\b|\\becmascript\\b|\\bes20\\d\\d\\b'),
    t('redux', 'Redux', 'frontend', '\\bredux\\b'),
    t('mobx', 'MobX', 'frontend', '\\bmobx\\b'),
    t('rxjs', 'RxJS', 'frontend', '\\brxjs\\b'),
    t('graphql', 'GraphQL', 'frontend', '\\bgraphql\\b|\\bapollo\\b'),
    t('webpack', 'Webpack', 'frontend', '\\bwebpack\\b'),
    t('vite', 'Vite', 'frontend', '\\bvite\\b'),
    t('tailwind', 'Tailwind CSS', 'frontend', '\\btailwind\\b'),
    t('mui', 'Material UI', 'frontend', '\\bmaterial[- ]?ui\\b|\\bmui\\b'),
    t('sass', 'SASS/SCSS', 'frontend', '\\bs[ac]ss\\b'),
    t('jquery', 'jQuery', 'frontend', '\\bjquery\\b'),
    t('webgl', 'WebGL/Three.js', 'frontend', '\\bwebgl\\b|\\bthree\\.?js\\b'),
    t('pwa', 'PWA/Web Workers', 'frontend', '\\bpwa\\b|\\bweb ?workers?\\b|\\bservice ?workers?\\b'),
    t('wasm', 'WebAssembly', 'frontend', '\\bwebassembly\\b|\\bwasm\\b'),
    t('websocket', 'WebSocket', 'frontend', '\\bwebsockets?\\b|\\bsocket\\.io\\b'),
    t('storybook', 'Storybook', 'frontend', '\\bstorybook\\b'),
    // Backend
    t('nodejs', 'Node.js', 'backend', '\\bnode(\\.?js)?\\b'),
    t('nestjs', 'NestJS', 'backend', '\\bnest\\.?js\\b'),
    t('express', 'Express', 'backend', '\\bexpress(\\.?js)?\\b'),
    t('dotnet', '.NET', 'backend', '(?<![\\w.])\\.net\\b|\\basp\\.net\\b|\\bdotnet\\b'),
    t('csharp', 'C#', 'backend', '\\bc#'),
    t('java', 'Java', 'backend', '\\bjava\\b'),
    t('spring', 'Spring', 'backend', '\\bspring( ?boot)?\\b'),
    t('kotlin', 'Kotlin', 'backend', '\\bkotlin\\b'),
    t('python', 'Python', 'backend', '\\bpython\\b'),
    t('django', 'Django', 'backend', '\\bdjango\\b'),
    t('fastapi', 'FastAPI/Flask', 'backend', '\\bfastapi\\b|\\bflask\\b'),
    // Jobs: "Golang", "Go Developer", "(Go)", "Java/Go". CVs: capitalized "Go", which is almost always the language there
    t(
        'go',
        'Go',
        'backend',
        '\\bgolang\\b|\\bgo (developer|engineer)\\b|\\(go\\)|\\bgo/|/go\\b',
        "\\b(Go|Golang|GO)\\b(?![-'’])",
    ),
    t('php', 'PHP', 'backend', '\\bphp\\b'),
    t('laravel', 'Laravel', 'backend', '\\blaravel\\b'),
    t('symfony', 'Symfony', 'backend', '\\bsymfony\\b'),
    t('wordpress', 'WordPress', 'backend', '\\bwordpress\\b'),
    t('ruby', 'Ruby/Rails', 'backend', '\\bruby\\b|\\brails\\b'),
    t('rust', 'Rust', 'backend', '\\brust\\b'),
    t('scala', 'Scala', 'backend', '\\bscala\\b'),
    t('elixir', 'Elixir', 'backend', '\\belixir\\b'),
    t('cpp', 'C++', 'backend', '\\bc\\+\\+'),
    t('postgres', 'PostgreSQL', 'backend', '\\bpostgres(ql)?\\b'),
    t('mysql', 'MySQL', 'backend', '\\bmysql\\b|\\bmariadb\\b'),
    t('mongodb', 'MongoDB', 'backend', '\\bmongo(db)?\\b'),
    t('redis', 'Redis', 'backend', '\\bredis\\b'),
    t('kafka', 'Kafka', 'backend', '\\bkafka\\b'),
    t('rabbitmq', 'RabbitMQ', 'backend', '\\brabbitmq\\b'),
    t('elastic', 'Elasticsearch', 'backend', '\\belastic(search)?\\b'),
    t('mssql', 'MS SQL Server', 'backend', '\\bmssql\\b|\\bsql server\\b|\\bt-sql\\b'),
    t('cassandra', 'Cassandra', 'backend', '\\bcassandra\\b'),
    t('grpc', 'gRPC/Protobuf', 'backend', '\\bgrpc\\b|\\bprotobuf\\b|\\bprotocol buffers\\b'),
    // Mobile
    t('reactnative', 'React Native', 'mobile', '\\breact[\\s-]*native\\b'),
    t('flutter', 'Flutter', 'mobile', '\\bflutter\\b|\\bdart\\b'),
    t('swift', 'Swift/iOS', 'mobile', '\\bswift(ui)?\\b|\\bios developer\\b'),
    // In a CV "shipped it into our iOS and Android apps" is a platform pair, not Android development; "built Android
    // apps", "Skills: Android, iOS" still count
    t(
        'android',
        'Android',
        'mobile',
        '\\bandroid\\b',
        '\\b(Android|ANDROID|android)\\b' +
            '(?!(?<=iOS\\s*(and|&|/|,)\\s*\\w+)\\s+(apps?|applications?)\\b)' +
            '(?!\\s*(and|&|/|,)\\s*iOS\\s+(apps?|applications?)\\b)' +
            '(?!\\s+(devices?|phones?|users?)\\b)',
    ),
    t('ionic', 'Ionic/Capacitor', 'mobile', '\\bionic\\b|\\bcapacitor\\b'),
    // DevOps / Cloud
    t('docker', 'Docker', 'devops', '\\bdocker\\b'),
    t('kubernetes', 'Kubernetes', 'devops', '\\bkubernetes\\b|\\bk8s\\b'),
    t('aws', 'AWS', 'devops', '\\baws\\b|\\bamazon web services\\b'),
    t('gcp', 'Google Cloud', 'devops', '\\bgcp\\b|\\bgoogle cloud\\b|\\bfirebase\\b'),
    t('azure', 'Azure', 'devops', '\\bazure\\b'),
    t('terraform', 'Terraform/Ansible', 'devops', '\\bterraform\\b|\\bansible\\b'),
    t('observability', 'Prometheus/Grafana', 'devops', '\\bprometheus\\b|\\bgrafana\\b|\\bopentelemetry\\b'),
    t('cicd', 'CI/CD', 'devops', '\\bci ?/ ?cd\\b|\\bgithub actions\\b|\\bgitlab ci\\b|\\bjenkins\\b'),
    t('linux', 'Linux', 'devops', '\\blinux\\b'),
    // Data / ML
    t('sql', 'SQL', 'data', '\\bsql\\b'),
    t('pandas', 'Pandas/NumPy', 'data', '\\bpandas\\b|\\bnumpy\\b'),
    t('ml', 'Machine Learning', 'data', '\\bmachine learning\\b|\\bpytorch\\b|\\btensorflow\\b|\\bscikit'),
    t(
        'llm',
        'LLM/AI',
        'data',
        '\\bllms?\\b|\\bopenai\\b|\\blangchain\\b|\\bgenerative ai\\b|\\bagentic\\b|\\brag\\b|\\bmcp\\b|\\bvector search\\b',
    ),
    t('spark', 'Spark', 'data', '\\bspark\\b|\\bdatabricks\\b'),
    t('clickhouse', 'ClickHouse', 'data', '\\bclickhouse\\b'),
    // QA
    t('jest', 'Jest/Vitest', 'qa', '\\bjest\\b|\\bvitest\\b|\\btesting library\\b'),
    t('cypress', 'Cypress', 'qa', '\\bcypress\\b'),
    t('playwright', 'Playwright', 'qa', '\\bplaywright\\b'),
    t('selenium', 'Selenium', 'qa', '\\bselenium\\b'),
]

export const techById = (id: string) => TECHS.find((x) => x.id === id)

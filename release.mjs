import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// Bump the version in the source manifest (regex keeps the file's formatting).
// `npm run release` bumps the patch, `npm run release -- minor` / `-- major` the higher parts.
const MANIFEST = 'public/manifest.json'
const source = readFileSync(MANIFEST, 'utf8')
const [major, minor, patch] = JSON.parse(source).version.split('.').map(Number)
const part = process.argv[2] ?? 'patch'
const version = {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
}[part]
if (!version) throw new Error(`Unknown version part "${part}": use major, minor or patch`)
const name = `job-radar-${version}`

if (existsSync(`extensions/${name}`)) throw new Error(`extensions/${name} already exists`)
writeFileSync(MANIFEST, source.replace(/("version":\s*")[^"]+"/, `$1${version}"`))

try {
    execFileSync('node', ['build.mjs'], { stdio: 'inherit' })
} catch (e) {
    writeFileSync(MANIFEST, source) // don't burn a version number on a failed build
    throw e
}

mkdirSync('extensions', { recursive: true })
cpSync('dist', `extensions/${name}`, { recursive: true })

console.log(`\n  ${major}.${minor}.${patch} → ${version}`)
console.log(`  extensions/${name}/      ← chrome://extensions → «Завантажити розпаковане»`)

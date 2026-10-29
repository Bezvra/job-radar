import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

// Zip the latest release (the one matching the current manifest version), e.g. for the Chrome Web Store
const { version } = JSON.parse(readFileSync('public/manifest.json', 'utf8'))
const name = `job-radar-${version}`

if (!existsSync(`extensions/${name}`)) throw new Error(`extensions/${name} not found — run npm run release first`)
// The Web Store assigns its own ID and rejects a "key", which only pins the ID of unpacked builds: zip a copy without it
const tmp = mkdtempSync(join(tmpdir(), 'job-radar-'))
cpSync(`extensions/${name}`, tmp, { recursive: true })
const manifest = JSON.parse(readFileSync(join(tmp, 'manifest.json'), 'utf8'))
delete manifest.key
writeFileSync(join(tmp, 'manifest.json'), JSON.stringify(manifest, null, 4))
rmSync(`extensions/${name}.zip`, { force: true })
execFileSync('zip', ['-qr', resolve(`extensions/${name}.zip`), '.'], { cwd: tmp })
rmSync(tmp, { recursive: true, force: true })

console.log(`  extensions/${name}.zip`)

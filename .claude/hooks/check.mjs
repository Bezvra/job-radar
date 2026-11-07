// PostToolUse hook (Edit|Write): formats the changed file with Prettier, then typechecks the project.
// Gets the tool call as JSON on stdin. Exit 2 sends stderr back to Claude as feedback; exit 0 is silent.
import { execFileSync } from 'node:child_process'
import { relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const input = JSON.parse(await new Response(process.stdin).text())
const file = input.tool_input?.file_path
if (!file) process.exit(0)

const path = relative(root, resolve(file))
// Outside the repository (scratchpad, memory) or in build output: not ours to check
if (path.startsWith('..') || /^(dist|extensions|node_modules)\//.test(path)) process.exit(0)

const run = (cmd, args) => {
    try {
        execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
        return null
    } catch (e) {
        return `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() || String(e)
    }
}

const problems = []
if (/\.(ts|tsx|mjs|js|json|css|html|md|ya?ml)$/.test(path)) {
    // --ignore-unknown and .prettierignore keep it off files Prettier shouldn't touch
    const error = run('npx', ['prettier', '--write', '--ignore-unknown', '--log-level', 'warn', path])
    if (error) problems.push(`Prettier failed on ${path}:\n${error}`)
}
if (/\.(ts|tsx)$/.test(path)) {
    const error = run('npx', ['tsc'])
    if (error) problems.push(`Typecheck failed (npm run typecheck):\n${error}`)
}

if (problems.length) {
    console.error(problems.join('\n\n'))
    process.exit(2)
}

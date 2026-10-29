import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
rmSync('dist', { recursive: true, force: true })
mkdirSync('dist')
cpSync('public', 'dist', { recursive: true })
// pdf.js parses in a web worker, loaded by URL from the onboarding page (see src/services/pdf.ts)
cpSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'dist/pdf.worker.min.mjs')
await build({
    entryPoints: {
        background: 'src/background.ts',
        report: 'src/pages/report.tsx',
        options: 'src/pages/options.tsx',
        onboarding: 'src/pages/onboarding.tsx',
        popup: 'src/pages/popup.tsx',
    },
    outdir: 'dist',
    bundle: true,
    format: 'esm',
    target: 'chrome116',
    minify: false,
    logLevel: 'info',
})

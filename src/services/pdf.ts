import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'

// The worker is copied into dist/ by build.mjs; extension pages can load it from their own origin
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs')

/** Plain text of a PDF, one line per text line. Empty for scanned PDFs (images without a text layer). */
export async function pdfToText(file: File): Promise<string> {
    const task = getDocument({ data: await file.arrayBuffer() })
    try {
        const doc = await task.promise
        const pages: string[] = []
        for (let i = 1; i <= doc.numPages; i++) {
            const content = await (await doc.getPage(i)).getTextContent()
            pages.push(
                content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join(''),
            )
        }
        return pages.join('\n')
    } finally {
        await task.destroy()
    }
}

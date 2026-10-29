import { useState } from 'preact/hooks'
import { t } from '../../../i18n'
import { pdfToText } from '../../../services/pdf'

interface Props {
    onText: (text: string) => void
    /** Without a CV: pick the stack by hand on the next steps */
    onManual: () => void
    onSkip: () => void
}

export function UploadStep({ onText, onManual, onSkip }: Props) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [dragging, setDragging] = useState(false)

    const read = async (file: File | undefined) => {
        if (!file) return
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            return setError(t.upload.needPdf)
        }
        setBusy(true)
        setError('')
        try {
            const text = await pdfToText(file)
            if (text.replace(/\s/g, '').length < 100) {
                setError(t.upload.scan)
            } else {
                onText(text)
            }
        } catch (e) {
            setError(t.upload.unreadable((e as Error).message))
        } finally {
            setBusy(false)
        }
    }

    return (
        <fieldset>
            <legend>{t.upload.legend}</legend>
            <label
                class={`dropzone${dragging ? ' is-over' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    void read(e.dataTransfer?.files[0])
                }}
            >
                <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={busy}
                    onChange={(e) => void read(e.currentTarget.files?.[0])}
                />
                <strong>{busy ? t.upload.reading : t.upload.drop}</strong>
                <span class="hint">{t.upload.dropHint}</span>
            </label>
            {error && <div class="hint err">{error}</div>}
            <div class="actions" style={{ marginTop: 12 }}>
                <button onClick={onManual} title={t.upload.manualTitle}>
                    {t.upload.manual}
                </button>
                <button onClick={onSkip} title={t.upload.skipTitle}>
                    {t.upload.skip}
                </button>
            </div>
        </fieldset>
    )
}

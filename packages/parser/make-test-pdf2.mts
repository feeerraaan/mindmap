import { PDFDocument, StandardFonts } from 'pdf-lib'

const doc = await PDFDocument.create()
const page = doc.addPage()
const font = await doc.embedFont(StandardFonts.Helvetica)
const text = 'Hello MindMap. This is a real PDF for the upload pipeline test. The cardiac cycle is divided into systole and diastole. The mitral valve closes during systole. The aortic valve opens during systole.'
page.drawText(text, { x: 50, y: 700, size: 14, font })

// Use object streams: false to keep PDF parsable by older pdfjs.
const bytes = await doc.save({ useObjectStreams: false })
await import('node:fs/promises').then((fs) => fs.writeFile('/tmp/real2.pdf', bytes))
console.log('Wrote /tmp/real2.pdf,', bytes.byteLength, 'bytes')

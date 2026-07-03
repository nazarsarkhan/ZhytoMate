import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import WordExtractor from 'word-extractor';

const minUsefulTextLength = 20;

function cleanText(value) {
  return (value || '')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function inferKind(url, contentType) {
  const extension = getExtension(url);
  const type = (contentType || '').toLowerCase();

  if (extension === 'pdf' || type.includes('application/pdf')) {
    return 'pdf';
  }

  if (
    extension === 'docx'
    || type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ) {
    return 'docx';
  }

  if (extension === 'doc' || type.includes('application/msword')) {
    return 'doc';
  }

  if (extension === 'txt' || type.startsWith('text/')) {
    return 'text';
  }

  return null;
}

async function extractPdf(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractDoc(buffer) {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody();
}

export async function extractTextFromBuffer({ url, contentType, buffer }) {
  const kind = inferKind(url, contentType);

  if (!kind) {
    return {
      ok: false,
      text: '',
      kind: null,
      error: `unsupported document type: ${contentType || getExtension(url) || 'unknown'}`,
    };
  }

  try {
    let text;

    if (kind === 'pdf') {
      text = await extractPdf(buffer);
    } else if (kind === 'docx') {
      text = await extractDocx(buffer);
    } else if (kind === 'doc') {
      text = await extractDoc(buffer);
    } else {
      text = buffer.toString('utf8');
    }

    const cleanedText = cleanText(text);

    if (cleanedText.length < minUsefulTextLength) {
      return {
        ok: false,
        text: '',
        kind,
        error: 'no useful text extracted; document may be scanned or empty',
      };
    }

    return {
      ok: true,
      text: cleanedText,
      kind,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      text: '',
      kind,
      error: error.message,
    };
  }
}

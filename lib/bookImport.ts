export interface BookChapter {
  name: string;
  text: string;
}

const utf8 = new TextDecoder('utf-8');

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type ZipFiles = Map<string, () => Promise<Uint8Array>>;

function readZip(buf: ArrayBuffer): ZipFiles {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let end = buf.byteLength - 22;
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Файл не похож на EPUB');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const files: ZipFiles = new Map();
  for (let i = 0; i < count && v.getUint32(p, true) === 0x02014b50; i++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
    files.set(name, async () => {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const raw = bytes.subarray(start, start + size);
      return method === 0 ? raw : inflateRaw(raw);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

function xml(text: string, type: DOMParserSupportedType = 'application/xml'): Document {
  const doc = new DOMParser().parseFromString(text, type);
  if (doc.querySelector('parsererror')) throw new Error('Не удалось разобрать файл');
  return doc;
}

const dirOf = (path: string): string => path.slice(0, path.lastIndexOf('/') + 1);

function resolve(base: string, href: string): string {
  const parts = (base + decodeURIComponent(href.split('#')[0])).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}

const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,pre,dt,dd,div,blockquote';

function docLines(doc: Document): string[] {
  const body = doc.querySelector('body');
  if (!body) return [];
  const lines = [...body.querySelectorAll(BLOCKS)]
    .filter((el) => el.querySelector(BLOCKS) === null)
    .map((el) => clean(el.textContent))
    .filter(Boolean);
  if (lines.length > 0) return lines;
  return (body.textContent ?? '').split(/\n+/).map(clean).filter(Boolean);
}

function htmlDoc(text: string): Document {
  try {
    return xml(text, 'application/xhtml+xml');
  } catch {
    return new DOMParser().parseFromString(text, 'text/html');
  }
}

async function parseEpub(file: File): Promise<BookChapter[]> {
  const files = readZip(await file.arrayBuffer());
  const read = async (path: string): Promise<string> => {
    const open = files.get(path);
    if (!open) throw new Error(`В EPUB нет файла ${path}`);
    return utf8.decode(await open());
  };

  const container = xml(await read('META-INF/container.xml'));
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new Error('В EPUB нет описания книги');
  const opf = xml(await read(opfPath));
  const base = dirOf(opfPath);

  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const item of opf.querySelectorAll('manifest > item')) {
    manifest.set(item.getAttribute('id') ?? '', {
      href: item.getAttribute('href') ?? '',
      type: item.getAttribute('media-type') ?? '',
      props: item.getAttribute('properties') ?? '',
    });
  }

  const labels = new Map<string, string>();
  const addLabel = (tocBase: string, href: string | null, label: string) => {
    if (!href || !label) return;
    const path = resolve(tocBase, href);
    if (!labels.has(path)) labels.set(path, label);
  };
  const navItem = [...manifest.values()].find((m) => m.props.split(' ').includes('nav'));
  const ncxItem = [...manifest.values()].find((m) => m.type === 'application/x-dtbncx+xml');
  try {
    if (navItem) {
      const navPath = resolve(base, navItem.href);
      const nav = htmlDoc(await read(navPath));
      const toc = [...nav.querySelectorAll('nav')].find((n) => (n.getAttribute('epub:type') ?? n.getAttribute('type') ?? '').includes('toc')) ?? nav;
      for (const a of toc.querySelectorAll('a')) addLabel(dirOf(navPath), a.getAttribute('href'), clean(a.textContent));
    } else if (ncxItem) {
      const ncxPath = resolve(base, ncxItem.href);
      const ncx = xml(await read(ncxPath));
      for (const point of ncx.querySelectorAll('navPoint')) {
        addLabel(dirOf(ncxPath), point.querySelector('content')?.getAttribute('src') ?? null, clean(point.querySelector('navLabel > text')?.textContent));
      }
    }
  } catch {
    labels.clear();
  }

  const chapters: BookChapter[] = [];
  for (const ref of opf.querySelectorAll('spine > itemref')) {
    const item = manifest.get(ref.getAttribute('idref') ?? '');
    if (!item || !/x?html/.test(item.type)) continue;
    const path = resolve(base, item.href);
    if (!files.has(path)) continue;
    const doc = htmlDoc(await read(path));
    const lines = docLines(doc);
    if (lines.length === 0) continue;
    const text = lines.join('\n');
    const prev = chapters[chapters.length - 1];
    if (prev && labels.size > 0 && !labels.has(path)) {
      prev.text += '\n' + text;
      continue;
    }
    const heading = clean(doc.querySelector('h1, h2, h3')?.textContent);
    chapters.push({ name: labels.get(path) || heading, text });
  }
  return chapters;
}

function fb2Text(bytes: ArrayBuffer): string {
  const head = new TextDecoder('latin1').decode(new Uint8Array(bytes, 0, Math.min(200, bytes.byteLength)));
  const enc = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return utf8.decode(bytes);
  }
}

async function parseFb2(file: File): Promise<BookChapter[]> {
  const doc = xml(fb2Text(await file.arrayBuffer()));
  const bodies = [...doc.querySelectorAll('body')];
  const main = bodies.find((b) => !b.hasAttribute('name')) ?? bodies[0];
  if (!main) throw new Error('В FB2 нет текста книги');

  const leaf = (sec: Element): BookChapter | null => {
    const lines = [...sec.querySelectorAll('p, subtitle, v')].map((el) => clean(el.textContent)).filter(Boolean);
    if (lines.length === 0) return null;
    const name = clean([...(sec.querySelector(':scope > title')?.querySelectorAll('p') ?? [])].map((p) => clean(p.textContent)).join(' '));
    return { name, text: lines.join('\n') };
  };
  const walk = (sec: Element, out: BookChapter[]) => {
    const kids = [...sec.children].filter((c) => c.localName === 'section');
    if (kids.length === 0) {
      const ch = leaf(sec);
      if (ch) out.push(ch);
    } else {
      for (const k of kids) walk(k, out);
    }
  };

  const out: BookChapter[] = [];
  const sections = [...main.children].filter((c) => c.localName === 'section');
  if (sections.length === 0) {
    const ch = leaf(main);
    if (ch) out.push(ch);
  } else {
    for (const s of sections) walk(s, out);
  }
  return out;
}

/** Splits an .epub or .fb2 file into chapters (name + plain text, paragraphs on separate lines). */
export async function parseBook(file: File): Promise<BookChapter[]> {
  const lower = file.name.toLowerCase();
  const chapters = lower.endsWith('.epub') ? await parseEpub(file) : lower.endsWith('.fb2') ? await parseFb2(file) : null;
  if (chapters === null) throw new Error('Поддерживаются файлы .epub и .fb2');
  if (chapters.length === 0) throw new Error('В файле не нашлось глав с текстом');
  return chapters;
}

export const withoutFirstLine = (text: string): string => text.split('\n').slice(1).join('\n');

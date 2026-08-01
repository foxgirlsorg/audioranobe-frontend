
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array<ArrayBuffer>, seed = 0): number {
  let c = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function u32(n: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function concat(parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function dosNow(): { time: number; date: number } {
  const d = new Date();
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

interface Entry {
  nameBytes: Uint8Array<ArrayBuffer>;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

export class ZipBuilder {
  private parts: BlobPart[] = [];
  private entries: Entry[] = [];
  private offset = 0;
  private used = new Set<string>();

  add(name: string, data: Uint8Array<ArrayBuffer>): void {
    const unique = this.uniqueName(name);
    const nameBytes = new TextEncoder().encode(unique);
    const { time, date } = dosNow();
    const crc = crc32(data);

    const header = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(date),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);

    this.entries.push({ nameBytes, crc, size: data.length, offset: this.offset, time, date });
    this.parts.push(header, data);
    this.offset += header.length + data.length;
  }

  build(): Blob {
    const centralStart = this.offset;
    const central: Uint8Array<ArrayBuffer>[] = [];

    for (const e of this.entries) {
      central.push(
        concat([
          u32(0x02014b50),
          u16(20),
          u16(20),
          u16(0x0800),
          u16(0),
          u16(e.time),
          u16(e.date),
          u32(e.crc),
          u32(e.size),
          u32(e.size),
          u16(e.nameBytes.length),
          u16(0),
          u16(0),
          u16(0),
          u16(0),
          u32(0),
          u32(e.offset),
          e.nameBytes,
        ])
      );
    }

    const centralBytes = concat(central);
    const end = concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(this.entries.length),
      u16(this.entries.length),
      u32(centralBytes.length),
      u32(centralStart),
      u16(0),
    ]);

    return new Blob([...this.parts, centralBytes, end], { type: 'application/zip' });
  }

  private uniqueName(name: string): string {
    if (!this.used.has(name)) {
      this.used.add(name);
      return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot === -1 ? name : name.slice(0, dot);
    const ext = dot === -1 ? '' : name.slice(dot);
    let n = 2;
    while (this.used.has(`${base}-${n}${ext}`)) n++;
    const unique = `${base}-${n}${ext}`;
    this.used.add(unique);
    return unique;
  }
}

export function safeEntryName(name: string, fallback = 'file'): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\\:*?"<>|\u0000-\u001F]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 150);
  return cleaned || fallback;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

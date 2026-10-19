const MAGIC: [string, (b: Buffer) => boolean][] = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['image/webp', (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'],
];

/** Type réel d'une image d'après ses premiers octets (on ne fait jamais confiance au type annoncé). */
export function sniffImage(buf: Buffer): string | null {
  return MAGIC.find(([, test]) => test(buf))?.[0] ?? null;
}

/** Décode une image « data:…;base64,… », vérifie sa taille et son type réel. */
export function decodeImageDataUrl(dataUrl: string, maxBytes: number): { dataUrl: string } | { error: string } {
  const m = /^data:[\w/+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: 'invalid_file' };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > maxBytes) return { error: 'file_too_large' };
  const mime = sniffImage(buf);
  if (!mime) return { error: 'unsupported_type' };
  return { dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
}

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import { uuid } from './ids.ts';

/**
 * Stockage de fichiers (photos, vidéos). Pilote local par défaut (dossier data/uploads).
 * Un pilote S3 compatible (AWS, Cloudflare R2, Supabase Storage) est activé si S3_BUCKET est défini
 * (voir server/lib/s3.ts).
 */
const root = path.resolve(process.env.UPLOADS_DIR || path.join(path.dirname(config.databasePath === ':memory:' ? './data/x' : config.databasePath), 'uploads'));
fs.mkdirSync(root, { recursive: true });

const MAGIC: [string, (b: Buffer) => boolean][] = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['image/webp', (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'],
  ['video/mp4', (b) => b.subarray(4, 8).toString() === 'ftyp'],
  ['video/webm', (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3],
];

/** Détermine le type réel d'un fichier à partir de ses premiers octets (on ne fait jamais confiance à l'extension). */
export function sniffMime(buf: Buffer): string | null {
  return MAGIC.find(([, test]) => test(buf))?.[0] ?? null;
}

export function decodeDataUrl(dataUrl: string, maxBytes: number): { buf: Buffer; mime: string } | { error: string } {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return { error: 'invalid_file' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxBytes) return { error: 'file_too_large' };
  const mime = sniffMime(buf);
  if (!mime) return { error: 'unsupported_type' };
  return { buf, mime };
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' };

export const storage = {
  async put(prefix: string, buf: Buffer, mime: string) {
    const key = `${prefix}/${uuid()}.${EXT[mime] ?? 'bin'}`;
    const file = path.join(root, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, buf);
    return key;
  },
  path(key: string) {
    const file = path.resolve(root, key);
    if (!file.startsWith(root + path.sep)) throw new Error('chemin invalide');
    return file;
  },
  async remove(key: string) {
    await fs.promises.rm(this.path(key), { force: true });
  },
  mimeOf(key: string) {
    const ext = key.split('.').pop();
    return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
  },
};

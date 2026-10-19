import crypto from 'node:crypto';

export const uuid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
export const shortCode = (bytes = 6) => crypto.randomBytes(bytes).toString('base64url');

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api, auth, type Me } from './api';

interface Ctx {
  user: Me | null;
  loading: boolean;
  refresh: () => Promise<unknown>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Ctx | null>(null);

/** Session de l'utilisateur connecté (lue via /api/me ; cookie httpOnly géré par Auth.js). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 60_000, retry: false });
  const value = useMemo<Ctx>(
    () => ({
      user: me.data?.user ?? null,
      loading: me.isLoading,
      refresh: () => qc.invalidateQueries({ queryKey: ['me'] }),
      signOut: async () => {
        await auth.signOut();
        qc.setQueryData(['me'], { user: null });
      },
    }),
    [me.data, me.isLoading, qc],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors du AuthProvider');
  return ctx;
}

/** Réduit une image à 256 px (WebP, ou JPEG à défaut) pour la photo de profil (≤ 200 Ko). */
export async function compressAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d')!;
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  let url = canvas.toDataURL('image/webp', 0.82);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.85);
  return url;
}

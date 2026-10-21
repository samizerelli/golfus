import { isNative } from './platform';

/**
 * Partage d'un lien : feuille de partage iOS dans l'app (Messages, WhatsApp, Mail…), partage du navigateur
 * sur le site quand il existe. « unsupported » : à l'appelant de copier le lien à la place.
 */
export async function shareLink(p: { title: string; text?: string; url: string }): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: p.title, text: p.text, url: p.url, dialogTitle: p.title });
      return 'shared';
    } catch {
      // Feuille fermée sans choisir d'application
      return 'cancelled';
    }
  }
  if (!navigator.share) return 'unsupported';
  try {
    await navigator.share(p);
    return 'shared';
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

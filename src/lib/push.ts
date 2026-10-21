/**
 * Notifications push de l'app iOS. L'autorisation n'est demandée qu'après un geste de l'utilisateur
 * (bouton « Activer » dans le panneau Notifications), jamais au lancement.
 */
import { api } from './api';
import { isNative, pushDeviceStore } from './platform';

export type PushState = 'unsupported' | 'prompt' | 'granted' | 'denied';

const plugin = () => import('@capacitor/push-notifications').then((m) => m.PushNotifications);

export async function pushState(): Promise<PushState> {
  if (!isNative()) return 'unsupported';
  try {
    const { receive } = await (await plugin()).checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

/** Obtient le jeton de l'appareil auprès d'iOS puis l'enregistre sur le serveur pour le compte connecté. */
async function register(lang: string) {
  const P = await plugin();
  const token = await new Promise<string>((resolve, reject) => {
    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    const done = () => handles.forEach((h) => void h.then((x) => x.remove()));
    const timer = setTimeout(() => {
      done();
      reject(new Error('timeout'));
    }, 15000);
    handles.push(
      P.addListener('registration', (t) => {
        clearTimeout(timer);
        done();
        resolve(t.value);
      }),
      P.addListener('registrationError', (e) => {
        clearTimeout(timer);
        done();
        reject(new Error(e.error));
      }),
    );
    void P.register();
  });
  pushDeviceStore.set(token);
  await api.registerPushDevice(token, lang);
}

/** Bouton « Activer » : demande l'autorisation (une seule fois, iOS ne la redemande plus ensuite). */
export async function enablePush(lang: string): Promise<PushState> {
  if (!isNative()) return 'unsupported';
  const { receive } = await (await plugin()).requestPermissions();
  if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'prompt';
  await register(lang);
  return 'granted';
}

/** À chaque ouverture, compte connecté : iOS peut changer le jeton, on le renvoie sans rien demander. */
export async function refreshPush(lang: string) {
  if ((await pushState()) === 'granted') await register(lang).catch(() => undefined);
}

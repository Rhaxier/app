// Phone push registration (docs/OPEN_QUESTIONS.md, Q8). Does nothing unless
// the app is running as the Capacitor phone app AND VITE_ENABLE_PUSH=true.
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { env } from '@/lib/env';

export async function registerForPush(): Promise<void> {
  if (!env.enablePush || !Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.addListener('registration', (token) => {
    // Q8: once a device_tokens table exists, save token.value there so the
    // send-push Edge Function can reach this phone.
    console.info('Push registration token', token.value);
  });
  await PushNotifications.register();
}

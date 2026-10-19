// Capacitor wraps the built web app (dist/) into iOS and Android apps.
// Native projects are not generated yet: see README "Phone apps".
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Placeholder id. The real one is chosen when the school registers the store apps.
  appId: 'com.placeholder.schoolapp',
  appName: 'School App',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

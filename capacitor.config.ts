import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lettus.game',
  appName: 'Lettus',
  webDir: 'dist',
  server: {
    url: 'https://7070d062-099f-4326-907f-1d9c30324f1c.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;

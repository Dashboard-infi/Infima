import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cabinet.donneville',
  appName: 'Cabinet Donneville',
  webDir: 'build',
  server: {
    // En dev, pointer vers le serveur local
    // url: 'http://10.0.2.2:3000', // Android emulator -> localhost
    // cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0A3D62',
      showSpinner: false
    }
  }
};

export default config;

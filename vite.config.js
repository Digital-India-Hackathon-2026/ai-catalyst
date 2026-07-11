import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        portal: resolve(__dirname, 'frontend/pages/index.html'),
        civic: resolve(__dirname, 'frontend/pages/civic/index.html'),
        civic_employee: resolve(__dirname, 'frontend/pages/civic/employee-profile.html'),
        civic_track: resolve(__dirname, 'frontend/pages/civic/track.html'),
        rescue: resolve(__dirname, 'frontend/pages/rescue/index.html'),
        rescue_control: resolve(__dirname, 'frontend/pages/rescue/control-room.html'),
        rescue_result: resolve(__dirname, 'frontend/pages/rescue/result.html'),
        rescue_team: resolve(__dirname, 'frontend/pages/rescue/team-dashboard.html'),
        rescue_track: resolve(__dirname, 'frontend/pages/rescue/track.html'),
        medical: resolve(__dirname, 'frontend/pages/medical/index.html')
      }
    }
  }
});

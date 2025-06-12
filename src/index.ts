import { FileBrowser3D } from './FileBrowser3D';

export { FileBrowser3D };

// Initialize the file browser when used as a script
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (canvas) {
      const fileBrowser = new FileBrowser3D(canvas);
      fileBrowser.init();
    }
  });
}

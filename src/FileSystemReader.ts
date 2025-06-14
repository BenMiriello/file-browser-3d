import { FileItem } from './FileBrowser3D';

export class FileSystemReader {
  private static rootDirectoryHandle: any = null;
  private static currentPath: string[] = [];

  /**
   * Read directory contents from the user's file system using File System Access API
   * @returns Promise resolving to array of FileItem objects
   */
  static async readDirectory(): Promise<FileItem[]> {
    try {
      // Check if we have File System Access API support
      if ('showDirectoryPicker' in window) {
        return await this.readWithFileSystemAPI();
      } else {
        // Fallback to webkitdirectory for broader browser support
        return await this.readWithWebkitDirectory();
      }
    } catch (error) {
      console.error('Error reading file system:', error);
      // Return empty array on error rather than crashing
      return [];
    }
  }

  /**
   * Read directory using modern File System Access API
   */
  private static async readWithFileSystemAPI(): Promise<FileItem[]> {
    try {
      // Request directory access - let user choose any directory (only if we don't have one)
      if (!this.rootDirectoryHandle) {
        this.rootDirectoryHandle = await (window as any).showDirectoryPicker({
          id: 'file-browser',
          mode: 'read',
        });
        this.currentPath = []; // Reset to root
      }

      const directoryHandle = this.rootDirectoryHandle;

      const items: FileItem[] = [];

      // Iterate through directory contents
      for await (const [name, handle] of directoryHandle.entries()) {
        // Skip hidden files/folders (starting with .)
        if (name.startsWith('.')) continue;

        const item: FileItem = {
          name: name,
          type: handle.kind === 'directory' ? 'folder' : 'file',
          path: `${directoryHandle.name || 'Unknown'}/${name}`,
        };

        // For files, try to get size if available
        if (handle.kind === 'file') {
          try {
            const file = await handle.getFile();
            item.size = file.size;
          } catch {
            // Size not available, continue without it
          }
        }

        items.push(item);
      }

      // Sort: folders first, then files, both alphabetically
      return items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
    } catch (error) {
      console.error('File System Access API error:', error);
      throw error;
    }
  }

  /**
   * Fallback using webkitdirectory for broader browser support
   */
  private static async readWithWebkitDirectory(): Promise<FileItem[]> {
    return new Promise((resolve, reject) => {
      // Create hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      input.style.display = 'none';

      input.onchange = (): void => {
        const files = Array.from(input.files || []);

        if (files.length === 0) {
          resolve([]);
          document.body.removeChild(input);
          return;
        }

        const items: FileItem[] = [];
        const seenNames = new Set<string>();

        // First, find the common root path
        const firstFile = files[0];
        if (!firstFile) {
          resolve([]);
          document.body.removeChild(input);
          return;
        }
        const basePath = firstFile.webkitRelativePath.split('/')[0];

        // Process all files and extract immediate children of the selected directory
        files.forEach(file => {
          const relativePath = file.webkitRelativePath;
          const pathParts = relativePath.split('/');

          // Skip the base directory name and get the immediate child
          if (pathParts.length >= 2) {
            const immediateChild = pathParts[1];

            if (immediateChild && !seenNames.has(immediateChild)) {
              seenNames.add(immediateChild);

              // Check if this is a directory by seeing if there are more path parts
              const isDirectory =
                pathParts.length > 2 ||
                files.some(f =>
                  f.webkitRelativePath.startsWith(
                    `${basePath}/${immediateChild}/`
                  )
                );

              const item: FileItem = {
                name: immediateChild,
                type: isDirectory ? 'folder' : 'file',
                path: `${basePath}/${immediateChild}`,
              };

              if (!isDirectory) {
                item.size = file.size;
              }

              items.push(item);
            }
          } else if (pathParts.length === 1) {
            // Root level file
            const fileName = pathParts[0];
            if (fileName && !seenNames.has(fileName)) {
              seenNames.add(fileName);
              items.push({
                name: fileName,
                type: 'file',
                size: file.size,
                path: fileName,
              });
            }
          }
        });

        // Sort: folders first, then files, both alphabetically
        const sorted = items.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        });

        resolve(sorted);
        document.body.removeChild(input);
      };

      input.onerror = (): void => {
        reject(new Error('Failed to read directory'));
        document.body.removeChild(input);
      };

      input.oncancel = (): void => {
        resolve([]); // Return empty array if user cancels
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Check if subdirectory navigation is supported
   */
  static isSubdirectoryNavigationSupported(): boolean {
    // Check if we have the modern File System Access API and a root handle
    const hasModernAPI = 'showDirectoryPicker' in window;
    const hasRootHandle = !!this.rootDirectoryHandle;
    return hasModernAPI && hasRootHandle;
  }

  /**
   * Check if any file system access is supported
   */
  static isFileSystemAPISupported(): boolean {
    // Check for either modern File System Access API or webkitdirectory
    const hasModernAPI = 'showDirectoryPicker' in window;
    const hasWebkitDirectory =
      'webkitdirectory' in document.createElement('input');

    return hasModernAPI || hasWebkitDirectory;
  }

  /**
   * Read a specific subdirectory by name
   */
  static async readSubdirectory(folderName: string): Promise<FileItem[]> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error(
        `Subdirectory navigation requires File System Access API ` +
          `(not available in this browser)`
      );
    }

    if (!this.rootDirectoryHandle) {
      throw new Error(
        'No root directory handle available - please select a directory first'
      );
    }

    try {
      // Navigate to the current directory handle
      let currentHandle = this.rootDirectoryHandle;

      // Navigate through the current path to get to current directory
      for (const pathSegment of this.currentPath) {
        currentHandle = await currentHandle.getDirectoryHandle(pathSegment);
      }

      // Get the subdirectory handle
      const subdirHandle = await currentHandle.getDirectoryHandle(folderName);

      // Read the subdirectory contents
      const items: FileItem[] = [];

      for await (const [name, handle] of subdirHandle.entries()) {
        // Skip hidden files/folders (starting with .)
        if (name.startsWith('.')) continue;

        const item: FileItem = {
          name: name,
          type: handle.kind === 'directory' ? 'folder' : 'file',
          path: `${this.currentPath.join('/')}/${folderName}/${name}`,
        };

        // For files, try to get size if available
        if (handle.kind === 'file') {
          try {
            const file = await handle.getFile();
            item.size = file.size;
          } catch {
            // Size not available, continue without it
          }
        }

        items.push(item);
      }

      // Sort: folders first, then files, both alphabetically
      return items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
    } catch (error) {
      console.error('Error reading subdirectory:', error);
      throw error;
    }
  }

  /**
   * Navigate into a subdirectory (updates current path)
   */
  static navigateInto(folderName: string): void {
    this.currentPath.push(folderName);
  }

  /**
   * Navigate back to parent directory
   */
  static navigateBack(): void {
    this.currentPath.pop();
  }

  /**
   * Get current path as string
   */
  static getCurrentPath(): string {
    return this.currentPath.length === 0
      ? '/'
      : '/' + this.currentPath.join('/');
  }

  /**
   * Reset to root directory
   */
  static resetToRoot(): void {
    this.currentPath = [];
  }

  /**
   * Get user-friendly error messages
   */
  static getErrorMessage(error: any): string {
    if (error.name === 'AbortError') {
      return 'Directory selection was cancelled';
    }
    if (error.name === 'NotAllowedError') {
      return 'Permission denied to access directory';
    }
    if (error.name === 'SecurityError') {
      return 'Security error: Cannot access directory';
    }
    return 'Failed to read directory contents';
  }
}

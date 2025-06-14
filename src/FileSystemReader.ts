import { FileItem } from './FileBrowser3D';

export class FileSystemReader {
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
      // Request directory access - let user choose any directory
      const directoryHandle = await (window as any).showDirectoryPicker({
        id: 'file-browser',
        mode: 'read',
      });

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
        const basePath = firstFile.webkitRelativePath.split('/')[0];

        // Process all files and extract immediate children of the selected directory
        files.forEach(file => {
          const relativePath = file.webkitRelativePath;
          const pathParts = relativePath.split('/');

          // Skip the base directory name and get the immediate child
          if (pathParts.length >= 2) {
            const immediateChild = pathParts[1];

            if (!seenNames.has(immediateChild)) {
              seenNames.add(immediateChild);

              // Check if this is a directory by seeing if there are more path parts
              const isDirectory =
                pathParts.length > 2 ||
                files.some(f =>
                  f.webkitRelativePath.startsWith(
                    `${basePath}/${immediateChild}/`
                  )
                );

              items.push({
                name: immediateChild,
                type: isDirectory ? 'folder' : 'file',
                path: `${basePath}/${immediateChild}`,
                size: isDirectory ? undefined : file.size,
              });
            }
          } else if (pathParts.length === 1) {
            // Root level file
            const fileName = pathParts[0];
            if (!seenNames.has(fileName)) {
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

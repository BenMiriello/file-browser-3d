import { FileItem } from './FileBrowser3D';

export class ServerFileSystemReader {
  private static currentPath: string = '';

  /**
   * Read directory contents from the server filesystem
   * @param path Optional path to read, defaults to home directory
   * @returns Promise resolving to array of FileItem objects
   */
  static async readDirectory(path?: string): Promise<FileItem[]> {
    try {
      const targetPath = path || this.currentPath;
      const response = await fetch(
        `/api/fs/list?path=${encodeURIComponent(targetPath)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Server filesystem error');
      }

      // Update current path to the actual resolved path from server
      this.currentPath = data.path;

      // Show enhanced warning with solution if permission denied or other issues
      if (data.warning) {
        this.showEnhancedWarning(
          data.warning,
          data.solution,
          data.permissionType
        );
      }

      return data.items;
    } catch (error) {
      console.error('Error reading server filesystem:', error);
      throw error;
    }
  }

  /**
   * Read a specific subdirectory
   * @param folderName Name of the folder to read
   * @returns Promise resolving to array of FileItem objects
   */
  static async readSubdirectory(folderName: string): Promise<FileItem[]> {
    try {
      // Navigate to subdirectory path
      const newPath = this.joinPath(this.currentPath, folderName);
      return await this.readDirectory(newPath);
    } catch (error) {
      console.error('Error reading server subdirectory:', error);
      throw error;
    }
  }

  /**
   * Navigate into a subdirectory (updates current path)
   * @param folderName Name of the folder to navigate into
   */
  static navigateInto(folderName: string): void {
    this.currentPath = this.joinPath(this.currentPath, folderName);
  }

  /**
   * Navigate back to parent directory
   */
  static navigateBack(): void {
    // Remove the last path segment
    const pathParts = this.currentPath.split('/');
    pathParts.pop();
    this.currentPath = pathParts.join('/') || '/';
  }

  /**
   * Get current path as string
   */
  static getCurrentPath(): string {
    return this.currentPath || '/';
  }

  /**
   * Reset to home directory
   */
  static async resetToHome(): Promise<void> {
    try {
      const response = await fetch('/api/fs/cwd');
      const data = await response.json();

      if (data.success) {
        this.currentPath = data.home;
      }
    } catch (error) {
      console.error('Error getting home directory:', error);
      this.currentPath = '';
    }
  }

  /**
   * Check if server filesystem is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      console.log('Checking server filesystem availability...');
      const response = await fetch('/api/fs/cwd');
      console.log('Server filesystem response status:', response.status);
      const isOk = response.ok;
      console.log('Server filesystem available:', isOk);
      if (isOk) {
        const data = await response.json();
        console.log('Server filesystem data:', data);
      }
      return isOk;
    } catch (error) {
      console.log('Server filesystem error:', error);
      return false;
    }
  }

  /**
   * Get user-friendly error messages
   */
  static getErrorMessage(error: any): string {
    if (error.message.includes('ENOENT')) {
      return 'Directory not found';
    }
    if (error.message.includes('EACCES')) {
      return 'Permission denied';
    }
    if (error.message.includes('EISDIR')) {
      return 'Is a directory';
    }
    if (error.message.includes('ENOTDIR')) {
      return 'Not a directory';
    }
    return error.message || 'Unknown filesystem error';
  }

  /**
   * Show enhanced warning message with solution to user
   */
  private static showEnhancedWarning(
    message: string,
    solution?: string,
    permissionType?: string
  ): void {
    // Create a non-blocking warning popup with enhanced styling
    const popup = document.createElement('div');
    const isFullDiskAccess = permissionType === 'full_disk_access_required';

    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isFullDiskAccess ? 'rgba(255, 152, 0, 0.95)' : 'rgba(255, 193, 7, 0.95)'};
      color: #000;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      max-width: 400px;
      word-wrap: break-word;
      border: 2px solid ${isFullDiskAccess ? '#ff9800' : '#ffc107'};
    `;

    // Create content with message and solution
    const messageEl = document.createElement('div');
    messageEl.style.cssText = 'font-weight: 600; margin-bottom: 8px;';
    messageEl.textContent = message;

    popup.appendChild(messageEl);

    if (solution) {
      const solutionEl = document.createElement('div');
      solutionEl.style.cssText =
        'font-size: 12px; opacity: 0.9; line-height: 1.4;';
      solutionEl.textContent = `💡 ${solution}`;
      popup.appendChild(solutionEl);
    }

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.7;
      padding: 0;
      width: 20px;
      height: 20px;
    `;
    closeBtn.onclick = () => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    };
    popup.appendChild(closeBtn);

    document.body.appendChild(popup);

    // Auto-remove after 8 seconds for enhanced warnings (longer due to more content)
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 8000);
  }

  /**
   * Helper to join paths correctly
   */
  private static joinPath(basePath: string, segment: string): string {
    if (!basePath) return segment;

    // Handle different path separators
    const separator = basePath.includes('\\') ? '\\' : '/';

    // Remove trailing separator from base
    const cleanBase = basePath.replace(/[/\\]+$/, '');

    // Add segment with appropriate separator
    return `${cleanBase}${separator}${segment}`;
  }
}

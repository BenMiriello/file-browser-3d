import { readdir, stat, access } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { constants } from 'fs';

// Get the user's home directory as the default starting point
const HOME_DIR = homedir();

/**
 * Check if we have Full Disk Access by testing access to a protected file
 */
async function checkFullDiskAccess() {
  try {
    // Try to access TimeMachine preferences - requires Full Disk Access
    await access('/Library/Preferences/com.apple.TimeMachine.plist', constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get helpful permission guidance based on the error type
 */
function getPermissionGuidance(error, path) {
  const hasFullDiskAccess = error.fullDiskAccess;
  
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    if (!hasFullDiskAccess && (
      path.includes('/Library/') || 
      path.includes('/System/') ||
      path.includes('iCloud') ||
      path.includes('.photoslibrary') ||
      path.includes('AddressBook') ||
      path.includes('Mail/')
    )) {
      return {
        message: 'Permission denied - folder requires Full Disk Access',
        solution: 'Grant Full Disk Access to Terminal in System Preferences → Security & Privacy → Privacy → Full Disk Access',
        type: 'full_disk_access_required'
      };
    }
    
    return {
      message: 'Permission denied - insufficient privileges',
      solution: 'Check folder permissions or run with appropriate privileges',
      type: 'permission_denied'
    };
  }
  
  if (error.code === 'ENOENT') {
    return {
      message: 'Directory not found',
      solution: 'Verify the path exists and is correctly spelled',
      type: 'not_found'
    };
  }
  
  return {
    message: error.message,
    solution: 'Check system logs for more details',
    type: 'unknown'
  };
}

/**
 * Vite plugin to add filesystem API endpoints
 */
export function filesystemApiPlugin() {
  return {
    name: 'filesystem-api',
    configureServer(server) {
      // Simple test endpoint first
      server.middlewares.use('/api/test', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'API plugin is working!' }));
      });

      // API endpoint to list directory contents
      server.middlewares.use('/api/fs/list', async (req, res) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const requestedPath = url.searchParams.get('path') || HOME_DIR;
          
          // Security: resolve path and ensure it's absolute
          const safePath = resolve(requestedPath);
          
          // Read directory contents
          const items = await readdir(safePath, { withFileTypes: true });
          const fileItems = [];
          
          for (const item of items) {
            // Skip hidden files/folders (starting with .)
            if (item.name.startsWith('.')) continue;
            
            const itemPath = join(safePath, item.name);
            
            try {
              const stats = await stat(itemPath);
              
              fileItems.push({
                name: item.name,
                type: item.isDirectory() ? 'folder' : 'file',
                size: item.isFile() ? stats.size : undefined,
                path: itemPath,
                modified: stats.mtime.toISOString()
              });
            } catch (err) {
              // Skip items we can't stat (permission issues, etc.)
              console.warn(`Skipping ${itemPath}: ${err.message}`);
            }
          }
          
          // Sort: folders first, then files, both alphabetically
          fileItems.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name, undefined, { numeric: true });
          });
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            path: safePath,
            items: fileItems
          }));
          
        } catch (error) {
          console.error('Filesystem API error:', error);
          
          // Get the requested path from URL for error reporting
          const url = new URL(req.url, `http://${req.headers.host}`);
          const requestedPath = url.searchParams.get('path') || HOME_DIR;
          
          // Check Full Disk Access status
          const hasFullDiskAccess = await checkFullDiskAccess();
          error.fullDiskAccess = hasFullDiskAccess;
          
          // Get enhanced guidance for the error
          const guidance = getPermissionGuidance(error, requestedPath);
          
          // Handle permission errors gracefully with detailed guidance
          if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'ENOENT') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              path: requestedPath,
              items: [],
              warning: guidance.message,
              solution: guidance.solution,
              permissionType: guidance.type,
              hasFullDiskAccess: hasFullDiskAccess
            }));
            return;
          }
          
          // For other errors, still return 500 but with better error info
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            code: error.code,
            path: requestedPath,
            hasFullDiskAccess: hasFullDiskAccess
          }));
        }
      });
      
      // API endpoint to get current working directory
      server.middlewares.use('/api/fs/cwd', async (_req, res) => {
        const hasFullDiskAccess = await checkFullDiskAccess();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          cwd: process.cwd(),
          home: HOME_DIR,
          hasFullDiskAccess: hasFullDiskAccess
        }));
      });

      // API endpoint to check Full Disk Access status
      server.middlewares.use('/api/fs/permissions', async (_req, res) => {
        const hasFullDiskAccess = await checkFullDiskAccess();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          hasFullDiskAccess: hasFullDiskAccess,
          guidance: hasFullDiskAccess 
            ? 'Full Disk Access is enabled - you can access all folders' 
            : 'Full Disk Access is not enabled - some system folders may be inaccessible'
        }));
      });
    }
  };
}

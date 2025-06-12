import { chromium } from 'playwright';
import { join } from 'path';

async function takeScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Try Claude's development server ports (3001, then 3002 if 3001 is busy)
    let serverUrl = 'http://localhost:3001';
    try {
      await page.goto(serverUrl, { waitUntil: 'domcontentloaded', timeout: 3000 });
    } catch {
      serverUrl = 'http://localhost:3002';
      await page.goto(serverUrl, { waitUntil: 'domcontentloaded', timeout: 3000 });
    }
    console.log(`Using server: ${serverUrl}`);
    
    // Wait for the 3D scene to initialize
    await page.waitForSelector('#canvas');
    await page.waitForTimeout(3000); // Give Three.js time to render
    
    // Create screenshots directory
    const screenshotDir = join(process.cwd(), 'screenshots');
    
    // Take full page screenshot
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    await page.screenshot({ 
      path: join(screenshotDir, `claude-fullpage-${timestamp}.png`),
      fullPage: true 
    });
    
    // Take canvas-only screenshot
    const canvas = page.locator('#canvas');
    await canvas.screenshot({ 
      path: join(screenshotDir, `claude-canvas-${timestamp}.png`) 
    });
    
    console.log(`Claude screenshots saved:`);
    console.log(`- claude-fullpage-${timestamp}.png`);
    console.log(`- claude-canvas-${timestamp}.png`);
    
  } catch (error) {
    console.error('Claude screenshot failed:', error);
    console.log('Make sure to run "npm run dev:claude" first to start the server on port 3001');
  } finally {
    await browser.close();
  }
}

takeScreenshot();
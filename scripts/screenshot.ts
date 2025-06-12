import { chromium } from 'playwright';
import { join } from 'path';

async function takeScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to the local development server
    await page.goto('http://localhost:3001');
    
    // Wait for the 3D scene to initialize
    await page.waitForSelector('#canvas');
    await page.waitForTimeout(3000); // Give Three.js time to render
    
    // Create screenshots directory
    const screenshotDir = join(process.cwd(), 'screenshots');
    
    // Take full page screenshot
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    await page.screenshot({ 
      path: join(screenshotDir, `fullpage-${timestamp}.png`),
      fullPage: true 
    });
    
    // Take canvas-only screenshot
    const canvas = page.locator('#canvas');
    await canvas.screenshot({ 
      path: join(screenshotDir, `canvas-${timestamp}.png`) 
    });
    
    console.log(`Screenshots saved:`);
    console.log(`- fullpage-${timestamp}.png`);
    console.log(`- canvas-${timestamp}.png`);
    
  } catch (error) {
    console.error('Screenshot failed:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshot();
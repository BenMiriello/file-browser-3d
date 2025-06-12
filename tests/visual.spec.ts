import { test, expect } from '@playwright/test';

test.describe('3D File Browser Visual Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the 3D scene to initialize
    await page.waitForSelector('#canvas');
    
    // Wait for Three.js to render (give it time for WebGL initialization)
    await page.waitForTimeout(3000);
    
    // Take a screenshot of the full page
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('3D scene renders with cards', async ({ page }) => {
    await page.goto('/');
    
    // Wait for canvas and 3D initialization
    await page.waitForSelector('#canvas');
    await page.waitForTimeout(3000);
    
    // Focus on just the 3D canvas
    const canvas = page.locator('#canvas');
    await expect(canvas).toHaveScreenshot('3d-scene.png');
  });

  test('card navigation interaction', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForSelector('#canvas');
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await expect(page.locator('#canvas')).toHaveScreenshot('initial-state.png');
    
    // Simulate scroll to navigate cards
    await page.locator('#canvas').hover();
    await page.mouse.wheel(0, 100);
    
    // Wait for animation to complete
    await page.waitForTimeout(1000);
    
    // Take screenshot after navigation
    await expect(page.locator('#canvas')).toHaveScreenshot('after-scroll.png');
  });

  test('responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    await page.waitForSelector('#canvas');
    await page.waitForTimeout(3000);
    
    await expect(page).toHaveScreenshot('mobile-view.png');
  });
});
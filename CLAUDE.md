# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a physics-based 3D file browser built with Three.js, GSAP, and Cannon.js. It displays file/folder cards in a diagonal formation using orthographic camera projection with isometric view.

## Development Commands

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build library for distribution (ES and UMD formats)
- `npm run preview` - Preview the built application
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix on TypeScript files
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting with Prettier
- `npm run typecheck` - Run TypeScript compiler without emitting files
- `npm run check` - Run all checks (typecheck, lint, format)

## Architecture

### Core Components

- **FileBrowser3D** (`src/FileBrowser3D.ts`) - Main class handling 3D scene, physics, and card navigation
- **Entry point** (`src/index.ts`) - Module export and DOM initialization

### Key Systems

- **3D Rendering**: Three.js with orthographic camera positioned at (10,10,10) for isometric view
- **Physics**: Cannon.js with zero gravity for floating card behavior
- **Animation**: GSAP for smooth card transitions and scaling effects
- **Navigation**: Mouse wheel and touch gestures for diagonal card browsing

### Card System

Cards are positioned in diagonal formation (top-left to bottom-right):
- Position calculation: `diagonalOffset * [0.7, -0.3, -0.7]` for x,y,z
- Selected card gets 1.15x scale and vertical lift (+0.8y, +0.3z)
- Physics bodies are kinematic (mass: 0) to prevent falling

### Materials and Lighting

- Cards use PBR materials with metalness/roughness/clearcoat
- Lighting setup: ambient + directional (with shadows) + two colored point lights
- Folders are slightly lighter grey (0x888888) vs files (0x777777)

## Build Configuration

The project builds as a library with external dependencies (Three.js, GSAP, Cannon.js). Vite config externalizes these dependencies for smaller bundle size.

## Code Quality & Error Detection

This project has comprehensive linting and type checking configured:

### IDE Integration
- Use `mcp__ide__getDiagnostics` to check for real-time IDE errors/warnings
- All TypeScript strict mode rules are enabled
- ESLint configured with TypeScript support and browser globals

### Development Workflow
- **Always run** `npm run check` before committing changes
- **Address all** TypeScript errors (zero tolerance policy)
- **Fix ESLint warnings** where possible (currently 3 `any` type warnings in physics code)
- **Use** `npm run lint:fix` and `npm run format` for auto-fixes

### Common Issues
- Physics body type casting requires `any` due to Three.js/Cannon.js compatibility
- Touch event handling has proper null checks for browser compatibility
- All browser globals (window, document, etc.) are properly configured in ESLint

## Visual Testing & Screenshots

This project includes comprehensive screenshot testing for the 3D file browser:

### Screenshot Commands
- `npm run screenshot` - Take instant screenshots of current state (saves to `screenshots/`)
- `npm run test:visual` - Run full visual regression test suite
- `npm run test:visual:ui` - Open Playwright test UI for interactive testing
- `npm run test:visual:update` - Update visual test baselines

### Screenshot Workflow
1. **Before changes**: Run `npm run screenshot` to capture baseline
2. **After changes**: Run `npm run screenshot` again to compare
3. **Use screenshots** to validate:
   - 3D scene renders correctly with WebGL
   - Card positioning and diagonal layout
   - Animation states and interactions
   - Responsive design on different viewports
   - Lighting and material effects

### Files
- `tests/visual.spec.ts` - Playwright visual tests
- `scripts/screenshot.ts` - User screenshot script (port 3000)
- `scripts/screenshot-claude.ts` - Claude screenshot script (port 3001)
- `screenshots/` - Screenshot output directory
- `playwright.config.ts` - User test configuration (port 3000)
- `playwright-claude.config.ts` - Claude test configuration (port 3001)

## Development Server Protocol

This project supports dual development servers to prevent conflicts:

### Port Allocation
- **Port 3000**: User development server (`npm run dev`)
- **Port 3001**: Claude development server (`npm run dev:claude`)

### Usage
**For User:**
- `npm run dev` - Start on port 3000
- `npm run screenshot` - Screenshot from port 3000
- `npm run test:visual` - Visual tests on port 3000

**For Claude:**
- `npm run dev:claude` - Start on port 3001  
- `npm run screenshot:claude` - Screenshot from port 3001
- `npm run test:visual:claude` - Visual tests on port 3001

### Benefits
- Both user and Claude can run servers simultaneously
- No need to stop/start each other's development sessions
- Independent testing and screenshot workflows
- Prevents port conflicts and development interruptions
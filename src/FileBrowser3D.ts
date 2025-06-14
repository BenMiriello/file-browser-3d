import * as THREE from 'three';
import { gsap } from 'gsap';
import { CardGeometry } from './CardGeometry';
import { TextRenderer } from './TextRenderer';
import { SceneSetup } from './SceneSetup';
import { ZoomControls } from './ZoomControls';
import { InputHandlers } from './InputHandlers';
import { ServerFileSystemReader } from './ServerFileSystemReader';
import { AnimationManager } from './animations/AnimationManager';
import { TransitionContext } from './animations/ITransition';

export interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size?: number;
  children?: FileItem[];
  path: string;
}

export class FileBrowser3D {
  // Positioning constants
  private static readonly CARD_SPACING = 1.5;
  private static readonly DIAGONAL_X_RATIO = -0.5;
  private static readonly DIAGONAL_Y_RATIO = -0.5;
  private static readonly DIAGONAL_Z_RATIO = 0.1;
  private static readonly ANIMATION_DURATION = 0.1;

  private scene: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private cards: THREE.Group[] = [];
  private scrollPosition = 0;
  private isAnimating = false;
  private zoomControls!: ZoomControls;
  private inputHandlers!: InputHandlers;
  private animationManager: AnimationManager;
  private currentDirectory: FileItem[] = [];
  private navigationStack: FileItem[][] = [];
  private isUsingRealFilesystem = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = SceneSetup.setupCamera();
    this.renderer = SceneSetup.setupRenderer(this.canvas);
    SceneSetup.setupLighting(this.scene);
    this.animationManager = new AnimationManager();
  }

  private createCard(fileItem: FileItem, index: number): THREE.Group {
    const cardGroup = CardGeometry.createCard(
      fileItem,
      index,
      FileBrowser3D.CARD_SPACING,
      {
        x: FileBrowser3D.DIAGONAL_X_RATIO,
        y: FileBrowser3D.DIAGONAL_Y_RATIO,
        z: FileBrowser3D.DIAGONAL_Z_RATIO,
      }
    );

    // Add text label
    TextRenderer.addTextToCard(
      cardGroup,
      fileItem.name,
      fileItem.type === 'folder'
    );

    return cardGroup;
  }

  private createCardsFromData(fileData: FileItem[]): void {
    // Clear existing cards
    this.cards.forEach(card => this.scene.remove(card));
    this.cards = [];

    // Create new cards
    fileData.forEach((item, index) => {
      const card = this.createCard(item, index);
      this.cards.push(card);
      this.scene.add(card);
    });

    // Reset scroll position and update positions
    this.scrollPosition = 0;
    this.updateCardPositions();
  }

  private async loadFileSystemData(): Promise<FileItem[]> {
    try {
      console.log('Loading filesystem data...');
      // Check if server filesystem is available
      const isServerAvailable = await ServerFileSystemReader.isAvailable();

      if (isServerAvailable) {
        console.log('Server filesystem is available, loading server data...');
        // Load from server filesystem (home directory)
        await ServerFileSystemReader.resetToHome();
        const serverData = await ServerFileSystemReader.readDirectory();
        console.log('Server data loaded:', serverData);
        this.currentDirectory = serverData;
        this.isUsingRealFilesystem = true;
        return serverData;
      } else {
        console.log('Server filesystem not available, using fallback data...');
        // Fallback to mock data if server is not available
        const fallbackData = this.createFallbackData();
        this.currentDirectory = fallbackData;
        this.isUsingRealFilesystem = false;
        return fallbackData;
      }
    } catch (error) {
      console.error('Failed to load server filesystem, using fallback:', error);
      const fallbackData = this.createFallbackData();
      this.currentDirectory = fallbackData;
      this.isUsingRealFilesystem = false;
      return fallbackData;
    }
  }

  private createFallbackData(): FileItem[] {
    return [
      { name: 'Documents', type: 'folder', path: '/Documents', children: [] },
      { name: 'Projects', type: 'folder', path: '/Projects', children: [] },
      { name: 'Images', type: 'folder', path: '/Images', children: [] },
      { name: 'readme.txt', type: 'file', size: 1024, path: '/readme.txt' },
      { name: 'config.json', type: 'file', size: 512, path: '/config.json' },
      { name: 'Music', type: 'folder', path: '/Music', children: [] },
      { name: 'Videos', type: 'folder', path: '/Videos', children: [] },
      { name: 'script.js', type: 'file', size: 2048, path: '/script.js' },
    ];
  }

  private setupEventListeners(): void {
    // Set up input handlers
    this.inputHandlers = new InputHandlers(
      this.canvas,
      () => this.cards,
      this.camera,
      () => this.scrollPosition,
      (pos: number) => {
        this.scrollPosition = pos;
      },
      () => this.updateCardPositions(),
      () => this.updateCardPositionsImmediate(),
      (direction: number) => this.navigateCards(direction),
      (zoom: number) => this.zoomControls.setZoom(zoom),
      () => this.zoomControls.getCurrentZoom(),
      FileBrowser3D.ANIMATION_DURATION,
      (cardIndex: number) => this.onCardClick(cardIndex)
    );

    this.inputHandlers.setupEventListeners();
  }

  private navigateCards(direction: number): void {
    if (this.isAnimating || this.inputHandlers.getAnimating()) return;

    // Cancel any other running animations first
    gsap.killTweensOf(this);
    this.inputHandlers.cancelAnimations();

    const newScrollPosition = Math.max(
      0,
      Math.min(this.cards.length - 1, this.scrollPosition + direction)
    );
    if (newScrollPosition === this.scrollPosition) return;

    this.isAnimating = true;

    // Animate scrollPosition smoothly instead of jumping
    gsap.to(this, {
      scrollPosition: newScrollPosition,
      duration: FileBrowser3D.ANIMATION_DURATION,
      ease: 'power2.out',
      onUpdate: () => this.updateCardPositions(),
      onComplete: () => {
        this.isAnimating = false;
      },
    });
  }

  private updateCardPositions(): void {
    this.cards.forEach((card, index) => {
      // Calculate smooth distance from scroll center
      const distanceFromCenter = Math.abs(index - this.scrollPosition);

      // Smooth scale interpolation (1.0 to 1.15 at center, drops off smoothly)
      const scale = 1.0 + 0.15 * Math.max(0, 1 - distanceFromCenter);

      // Smooth elevation interpolation (0 to 0.8 at center, drops off smoothly)
      const elevation = 0.6 * Math.max(0, 1 - distanceFromCenter);

      // Calculate final position directly (relative to scrollPosition with elevation)
      const centeredPosition = {
        x:
          (index - this.scrollPosition) *
          FileBrowser3D.CARD_SPACING *
          FileBrowser3D.DIAGONAL_X_RATIO,
        y:
          -(index - this.scrollPosition) *
            FileBrowser3D.CARD_SPACING *
            FileBrowser3D.DIAGONAL_Y_RATIO +
          elevation,
        z:
          -(index - this.scrollPosition) *
          FileBrowser3D.CARD_SPACING *
          FileBrowser3D.DIAGONAL_Z_RATIO,
      };

      // Smooth animations for each card (match main scroll duration)
      gsap.to(card.position, {
        x: centeredPosition.x,
        y: centeredPosition.y,
        z: centeredPosition.z,
        duration: FileBrowser3D.ANIMATION_DURATION,
        ease: 'power2.out',
      });

      gsap.to(card.scale, {
        x: scale,
        y: scale,
        z: scale,
        duration: FileBrowser3D.ANIMATION_DURATION,
        ease: 'power2.out',
      });
    });
  }

  private updateCardPositionsImmediate(): void {
    this.cards.forEach((card, index) => {
      // Calculate smooth distance from scroll center
      const distanceFromCenter = Math.abs(index - this.scrollPosition);

      // Smooth scale interpolation (1.0 to 1.15 at center, drops off smoothly)
      const scale = 1.0 + 0.15 * Math.max(0, 1 - distanceFromCenter);

      // Smooth elevation interpolation (0 to 0.8 at center, drops off smoothly)
      const elevation = 0.6 * Math.max(0, 1 - distanceFromCenter);

      // Calculate final position directly (relative to scrollPosition with elevation)
      const centeredPosition = {
        x:
          (index - this.scrollPosition) *
          FileBrowser3D.CARD_SPACING *
          FileBrowser3D.DIAGONAL_X_RATIO,
        y:
          -(index - this.scrollPosition) *
            FileBrowser3D.CARD_SPACING *
            FileBrowser3D.DIAGONAL_Y_RATIO +
          elevation,
        z:
          -(index - this.scrollPosition) *
          FileBrowser3D.CARD_SPACING *
          FileBrowser3D.DIAGONAL_Z_RATIO,
      };

      // Immediate position updates (no animation during drag)
      card.position.set(
        centeredPosition.x,
        centeredPosition.y,
        centeredPosition.z
      );
      card.scale.set(scale, scale, scale);
    });
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  public async init(): Promise<void> {
    try {
      // Load fallback data (no loading state - instant)
      const fileData = await this.loadFileSystemData();

      // Create cards from loaded data
      this.createCardsFromData(fileData);

      // Initialize zoom controls
      this.zoomControls = new ZoomControls(this.scene, this.camera, () => {
        // Handle window resize for renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });
      this.zoomControls.createZoomControl();

      // File system button no longer needed - server filesystem loads automatically

      this.setupEventListeners();

      // Initialize card positions so the first card is raised on load
      this.updateCardPositions();

      this.animate();
    } catch (error) {
      console.error('Failed to initialize FileBrowser3D:', error);
      // Show error popup instead of old error state
      this.showErrorPopup(
        'Initialization Error',
        `
        <strong>Failed to initialize 3D File Browser</strong><br><br>
        <strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}<br><br>
        Please refresh the page and try again.
      `
      );
    }
  }

  // getHomePath method removed - server provides home directory automatically

  // createFileSystemButton method removed - server filesystem loads automatically

  // Loading and error state methods removed - using popup system instead

  private async onCardClick(cardIndex: number): Promise<void> {
    if (this.animationManager.isAnimating()) return;

    const selectedItem = this.currentDirectory[cardIndex];
    if (!selectedItem) return;

    // Handle back navigation (..)
    if (selectedItem.name === '..') {
      await this.navigateBack();
      return;
    }

    // Handle regular folder navigation
    if (selectedItem.type !== 'folder') return;

    // Try to get real folder contents if we're using real filesystem
    let folderContents: FileItem[];
    if (this.isUsingRealFilesystem) {
      try {
        // Try to read the real subdirectory from server
        const realContents = await ServerFileSystemReader.readSubdirectory(
          selectedItem.name
        );

        // Add back navigation to the beginning
        folderContents = [
          { name: '..', type: 'folder', path: '../', children: [] },
          ...realContents,
        ];

        // Update ServerFileSystemReader's current path
        ServerFileSystemReader.navigateInto(selectedItem.name);
      } catch (error) {
        console.error('Failed to read server subdirectory:', error);
        // Show error popup instead of fake data
        this.showErrorPopup(
          'Server Folder Reading Error',
          `
          <strong>Failed to read folder: ${selectedItem.name}</strong><br><br>
          <strong>Error:</strong> ${ServerFileSystemReader.getErrorMessage(error)}<br><br>
          <strong>Details:</strong> Server filesystem reading failed. This could be due to:<br>
          • Permission issues on server<br>
          • Folder doesn't exist<br>
          • Server connection problems<br>
          • Path access restrictions<br><br>
          Try going back and selecting a different folder.
        `
        );
        return; // Don't navigate, just show error
      }
    } else {
      folderContents = this.createMockFolderContents(selectedItem.name);
    }

    await this.navigateToFolder(selectedItem, folderContents, cardIndex);
  }

  private async navigateToFolder(
    folder: FileItem,
    newContents: FileItem[],
    selectedCardIndex: number
  ): Promise<void> {
    // Save current directory to navigation stack
    this.navigationStack.push([...this.currentDirectory]);

    // Create new cards for folder contents
    const newCards: THREE.Group[] = [];
    newContents.forEach((item, index) => {
      const card = this.createCard(item, index);
      newCards.push(card);
    });

    // Set up transition context
    const context: TransitionContext = {
      scene: this.scene,
      currentCards: [...this.cards],
      newCards,
      selectedFolder: folder,
      selectedCardIndex,
    };

    // Execute transition
    await this.animationManager.executeTransition('dropAndFan', context);

    // Clean up old cards
    this.cards.forEach(card => this.scene.remove(card));

    // Update state
    this.cards = newCards;
    this.currentDirectory = newContents;
    this.scrollPosition = 0;
  }

  private createMockFolderContents(folderName: string): FileItem[] {
    // Create some mock contents based on folder name
    const mockContents: FileItem[] = [
      { name: '..', type: 'folder', path: '../', children: [] }, // Back button
    ];

    switch (folderName.toLowerCase()) {
      case 'documents':
        mockContents.push(
          {
            name: 'Report.pdf',
            type: 'file',
            size: 2048,
            path: '/Documents/Report.pdf',
          },
          {
            name: 'Notes.txt',
            type: 'file',
            size: 512,
            path: '/Documents/Notes.txt',
          },
          {
            name: 'Presentations',
            type: 'folder',
            path: '/Documents/Presentations',
            children: [],
          }
        );
        break;
      case 'projects':
        mockContents.push(
          {
            name: 'WebApp',
            type: 'folder',
            path: '/Projects/WebApp',
            children: [],
          },
          {
            name: 'MobileApp',
            type: 'folder',
            path: '/Projects/MobileApp',
            children: [],
          },
          {
            name: 'README.md',
            type: 'file',
            size: 1024,
            path: '/Projects/README.md',
          }
        );
        break;
      case 'images':
        mockContents.push(
          {
            name: 'vacation.jpg',
            type: 'file',
            size: 3072,
            path: '/Images/vacation.jpg',
          },
          {
            name: 'family.png',
            type: 'file',
            size: 2560,
            path: '/Images/family.png',
          },
          {
            name: 'Screenshots',
            type: 'folder',
            path: '/Images/Screenshots',
            children: [],
          }
        );
        break;
      default:
        mockContents.push(
          {
            name: 'file1.txt',
            type: 'file',
            size: 1024,
            path: `/${folderName}/file1.txt`,
          },
          {
            name: 'file2.txt',
            type: 'file',
            size: 512,
            path: `/${folderName}/file2.txt`,
          },
          {
            name: 'subfolder',
            type: 'folder',
            path: `/${folderName}/subfolder`,
            children: [],
          }
        );
    }

    return mockContents;
  }

  public async navigateBack(): Promise<void> {
    if (
      this.navigationStack.length === 0 ||
      this.animationManager.isAnimating()
    )
      return;

    const previousDirectory = this.navigationStack.pop()!;

    // Update ServerFileSystemReader path if using real filesystem
    if (this.isUsingRealFilesystem) {
      ServerFileSystemReader.navigateBack();
    }

    // Simple transition back (could use different animation)
    this.createCardsFromData(previousDirectory);
    this.currentDirectory = previousDirectory;
  }

  private showErrorPopup(title: string, content: string): void {
    // Remove existing popup if any
    const existingPopup = document.getElementById('file-browser-error-popup');
    if (existingPopup) {
      document.body.removeChild(existingPopup);
    }

    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.id = 'file-browser-error-popup';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    `;

    // Create popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
      background: #2a2a2a;
      color: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      max-height: 80%;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      position: relative;
      border: 1px solid #444;
    `;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 12px;
      right: 16px;
      background: none;
      border: none;
      color: #ccc;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = '#444';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
    });

    // Create title
    const titleElement = document.createElement('h2');
    titleElement.textContent = title;
    titleElement.style.cssText = `
      margin: 0 32px 16px 0;
      color: #ff6b6b;
      font-size: 20px;
      font-weight: bold;
    `;

    // Create content
    const contentElement = document.createElement('div');
    contentElement.innerHTML = content;
    contentElement.style.cssText = `
      line-height: 1.6;
      font-size: 14px;
      color: #e0e0e0;
    `;

    // Close popup function
    const closePopup = () => {
      if (overlay.parentNode) {
        document.body.removeChild(overlay);
      }
    };

    // Event listeners
    closeButton.addEventListener('click', closePopup);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closePopup();
      }
    });

    // Keyboard escape
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // Assemble popup
    popup.appendChild(closeButton);
    popup.appendChild(titleElement);
    popup.appendChild(contentElement);
    overlay.appendChild(popup);

    // Add to page
    document.body.appendChild(overlay);
  }
}

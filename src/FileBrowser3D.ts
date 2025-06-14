import * as THREE from 'three';
import { gsap } from 'gsap';
import { CardGeometry } from './CardGeometry';
import { TextRenderer } from './TextRenderer';
import { SceneSetup } from './SceneSetup';
import { ZoomControls } from './ZoomControls';
import { InputHandlers } from './InputHandlers';
import { FileSystemReader } from './FileSystemReader';
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
    // Always start with fallback data - file system access requires user interaction
    const data = this.createFallbackData();
    this.currentDirectory = data;
    return data;
  }

  private async loadRealFileSystem(): Promise<void> {
    try {
      this.showLoadingState();
      const files = await FileSystemReader.readDirectory();

      if (files.length > 0) {
        // Clear existing cards
        this.cards.forEach(card => this.scene.remove(card));
        this.cards = [];

        // Update current directory and create new cards
        this.currentDirectory = files;
        this.createCardsFromData(files);
      }
    } catch (error) {
      console.error('Failed to load real file system:', error);
      this.showErrorState('Failed to access file system');
    } finally {
      this.hideLoadingState();
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

      // Create file system button
      this.createFileSystemButton();

      this.setupEventListeners();

      // Initialize card positions so the first card is raised on load
      this.updateCardPositions();

      this.animate();
    } catch (error) {
      console.error('Failed to initialize FileBrowser3D:', error);
      this.showErrorState('Failed to load file system');
    }
  }

  private getHomePath(): string {
    // For mobile devices, just show a generic message
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        window.navigator.userAgent
      );

    if (isMobile) {
      return 'your files';
    }

    // For desktop, try to detect path
    const isWindows =
      window.navigator.platform.toUpperCase().indexOf('WIN') >= 0;
    const isMac =
      window.navigator.userAgent.includes('Mac') ||
      window.navigator.platform.includes('Mac');

    let username = 'user';
    const currentLocation = window.location.hostname;
    if (currentLocation === 'localhost' || currentLocation === '127.0.0.1') {
      // Development environment - use known username
      username = 'benmiriello';
    }

    if (isMac) {
      return `/Users/${username}`;
    } else if (isWindows) {
      return `C:\\Users\\${username}`;
    } else {
      // Linux/Unix
      return `/home/${username}`;
    }
  }

  private createFileSystemButton(): void {
    // Only show button if File System Access API is supported
    if (!FileSystemReader.isFileSystemAPISupported()) {
      return;
    }

    const homePath = this.getHomePath();

    const button = document.createElement('button');
    button.textContent = FileSystemReader.isFileSystemAPISupported()
      ? `Browse ${homePath}`
      : `File System Not Supported`;
    Object.assign(button.style, {
      position: 'fixed',
      top: '40px',
      left: '40px',
      padding: '12px 20px',
      backgroundColor: FileSystemReader.isFileSystemAPISupported()
        ? '#333333'
        : '#666666',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      cursor: FileSystemReader.isFileSystemAPISupported()
        ? 'pointer'
        : 'not-allowed',
      zIndex: '1000',
      transition: 'background-color 0.2s ease',
      whiteSpace: 'nowrap',
    });

    // Hover effect only if supported
    if (FileSystemReader.isFileSystemAPISupported()) {
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#555555';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#333333';
      });

      // Click handler
      button.addEventListener('click', () => {
        this.loadRealFileSystem();
      });
    }

    document.body.appendChild(button);
  }

  private showLoadingState(): void {
    // Create simple loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'file-browser-loading';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-family: Arial, sans-serif;
      font-size: 18px;
      z-index: 1000;
    `;
    loadingDiv.textContent = 'Loading files...';
    document.body.appendChild(loadingDiv);
  }

  private hideLoadingState(): void {
    const loadingDiv = document.getElementById('file-browser-loading');
    if (loadingDiv) {
      document.body.removeChild(loadingDiv);
    }
  }

  private showErrorState(message: string): void {
    this.hideLoadingState();

    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #ff6b6b;
      font-family: Arial, sans-serif;
      font-size: 18px;
      text-align: center;
      z-index: 1000;
    `;
    errorDiv.innerHTML = `
      <div>${message}</div>
      <div style="font-size: 14px; margin-top: 10px;">Using fallback data instead</div>
    `;
    document.body.appendChild(errorDiv);

    // Remove error message after 3 seconds
    window.setTimeout(() => {
      if (errorDiv.parentNode) {
        document.body.removeChild(errorDiv);
      }
    }, 3000);
  }

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

    // For now, create mock folder contents
    const folderContents = this.createMockFolderContents(selectedItem.name);

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

    // Simple transition back (could use different animation)
    this.createCardsFromData(previousDirectory);
    this.currentDirectory = previousDirectory;
  }
}

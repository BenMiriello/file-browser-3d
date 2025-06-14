import * as THREE from 'three';
import { gsap } from 'gsap';
import { CardGeometry } from './CardGeometry';
import { TextRenderer } from './TextRenderer';
import { SceneSetup } from './SceneSetup';
import { ZoomControls } from './ZoomControls';
import { InputHandlers } from './InputHandlers';

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

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = SceneSetup.setupCamera();
    this.renderer = SceneSetup.setupRenderer(this.canvas);
    SceneSetup.setupLighting(this.scene);
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

  private createTestData(): FileItem[] {
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
      this.cards,
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
      FileBrowser3D.ANIMATION_DURATION
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

  public init(): void {
    const testData = this.createTestData();
    testData.forEach((item, index) => {
      const card = this.createCard(item, index);
      this.cards.push(card);
      this.scene.add(card);
    });

    // Initialize zoom controls
    this.zoomControls = new ZoomControls(this.scene, this.camera, () => {
      // Handle window resize for renderer
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.zoomControls.createZoomControl();

    this.setupEventListeners();

    // Initialize card positions so the first card is raised on load
    this.updateCardPositions();

    this.animate();
  }
}

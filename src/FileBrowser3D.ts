import * as THREE from 'three';
import { gsap } from 'gsap';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

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

  // File Geometry constants
  private static readonly folderWidth = 2.25;
  private static readonly folderHeight = 1.75;
  private static readonly tabHeight = 0.5;
  private static readonly tabWidth = FileBrowser3D.folderWidth * (2 / 3);
  private static readonly fileWidth = 2;
  private static readonly fileHeight = 2.25;
  private static readonly folderColor = 0x707070;
  private static readonly fileColor = 0x888888;
  private static readonly cornerRadius = 0.05;
  private static readonly cardThickness = 0.075;

  private scene: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private world!: CANNON.World;
  private cards: THREE.Group[] = [];
  private cardBodies: CANNON.Body[] = [];
  private scrollPosition = 0;
  private isAnimating = false;
  private zoomControl: HTMLElement | null = null;
  private zoomSlider: HTMLElement | null = null;
  private isDragging = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.setupCamera();
    this.setupRenderer();
    this.setupPhysics();
    this.setupLighting();
  }

  private setupCamera(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;

    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );

    // Position camera isometrically from above and to the left
    this.camera.position.set(-8, 8, 8);
    this.camera.lookAt(0, 0, 0);
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0a0a, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
  }

  private setupPhysics(): void {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, 0, 0),
    });

    this.world.broadphase = new CANNON.NaiveBroadphase();
    // Set solver iterations if available
    if ('iterations' in this.world.solver) {
      (this.world.solver as any).iterations = 10;
    }
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.3;
  }

  private setupLighting(): void {
    // Ambient light for overall illumination (increased slightly)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Main directional light (reduced intensity for more natural look)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(20, 20, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    this.scene.add(directionalLight);

    // Fill light from top-left for more natural lighting
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(-15, 15, 10);
    this.scene.add(fillLight);

    // Accent lights for depth
    const accentLight1 = new THREE.PointLight(0x00ff88, 0.5, 100);
    accentLight1.position.set(-10, 5, 10);
    this.scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0x0088ff, 0.5, 100);
    accentLight2.position.set(10, 5, -10);
    this.scene.add(accentLight2);
  }

  private drawFolderGeometry(): THREE.BufferGeometry {
    // Create unified folder shape (body + tab) with consistent rounding
    const shape = new THREE.Shape();
    const w = FileBrowser3D.folderWidth;
    const h = FileBrowser3D.folderHeight;
    const tw = FileBrowser3D.tabWidth;
    const th = FileBrowser3D.tabHeight;
    const r = FileBrowser3D.cornerRadius;

    // Start from bottom-left corner of main body
    shape.moveTo(-w / 2 + r, -h / 2);

    // Bottom edge (rounded corners)
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);

    // Right edge of body up to tab level
    shape.lineTo(w / 2, h / 2 - r);

    // Top-right corner of body (rounded)
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);

    // Top edge of body (where tab starts)
    shape.lineTo(-w / 2 + tw, h / 2);

    // Tab outline
    shape.lineTo(-w / 2 + tw, h / 2 + th - r); // right edge of tab
    shape.quadraticCurveTo(
      -w / 2 + tw,
      h / 2 + th,
      -w / 2 + tw - r,
      h / 2 + th
    ); // top-right corner of tab
    shape.lineTo(-w / 2 + r, h / 2 + th); // top edge of tab
    shape.quadraticCurveTo(-w / 2, h / 2 + th, -w / 2, h / 2 + th - r); // top-left corner of tab
    shape.lineTo(-w / 2, h / 2); // left edge of tab down to body

    // Left edge of body down to bottom
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); // bottom-left corner

    const extrudeSettings = {
      depth: FileBrowser3D.cardThickness - FileBrowser3D.cornerRadius * 2, // Compensate for bevel thickness
      bevelEnabled: true,
      bevelSize: FileBrowser3D.cornerRadius,
      bevelThickness: FileBrowser3D.cornerRadius,
      bevelSegments: 5,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  private createFileGeometry(): THREE.BufferGeometry {
    const mainBody = new RoundedBoxGeometry(
      FileBrowser3D.fileWidth,
      FileBrowser3D.fileHeight,
      FileBrowser3D.cardThickness,
      5, // segments
      FileBrowser3D.cornerRadius
    );
    return mainBody;
  }

  private createCardMaterial(isFolder: boolean): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: isFolder ? FileBrowser3D.folderColor : FileBrowser3D.fileColor,
      metalness: 0.25,
      roughness: 0.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
      transmission: 0,
      thickness: 0.5,
    });
  }

  private createCard(fileItem: FileItem, index: number): THREE.Group {
    const cardGroup = new THREE.Group();

    // Card geometry based on type
    const isFolder = fileItem.type === 'folder';
    const cardGeometry = isFolder
      ? this.drawFolderGeometry()
      : this.createFileGeometry();

    const cardMaterial = this.createCardMaterial(isFolder);

    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;

    cardGroup.add(cardMesh);

    // Tab is now part of unified folder geometry, no separate mesh needed

    // Position cards in a diagonal row (top-left to bottom-right)
    const diagonalOffset = index * FileBrowser3D.CARD_SPACING;
    cardGroup.position.set(
      diagonalOffset * FileBrowser3D.DIAGONAL_X_RATIO,
      -diagonalOffset * FileBrowser3D.DIAGONAL_Y_RATIO,
      -diagonalOffset * FileBrowser3D.DIAGONAL_Z_RATIO
    );

    // Add physics body with no mass (kinematic)
    const cardShape = new CANNON.Box(new CANNON.Vec3(0.875, 1.125, 0.0375));
    const cardBody = new CANNON.Body({
      mass: 0, // Kinematic body - won't fall
      shape: cardShape,
      position: new CANNON.Vec3(
        cardGroup.position.x,
        cardGroup.position.y,
        cardGroup.position.z
      ),
    });

    this.world.addBody(cardBody);
    this.cardBodies.push(cardBody);

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
    // Mouse wheel for navigation
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      if (this.isAnimating) return;

      const delta = Math.sign(event.deltaY);
      this.navigateCards(delta);
    });

    // Touch events for mobile
    let touchStartX = 0;
    let touchStartY = 0;

    this.canvas.addEventListener('touchstart', event => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    });

    this.canvas.addEventListener('touchmove', event => {
      event.preventDefault();
    });

    this.canvas.addEventListener('touchend', event => {
      event.preventDefault();
      if (event.changedTouches.length === 0) return;

      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // Determine swipe direction
      const threshold = 50;
      if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          // Vertical swipe
          const delta = deltaY > 0 ? -1 : 1;
          this.navigateCards(delta);
        } else {
          // Horizontal swipe
          const delta = deltaX > 0 ? -1 : 1;
          this.navigateCards(delta);
        }
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      const frustumSize = 10;

      this.camera.left = (-frustumSize * aspect) / 2;
      this.camera.right = (frustumSize * aspect) / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = -frustumSize / 2;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private navigateCards(direction: number): void {
    if (this.isAnimating) return;

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

      // Update physics body position (no animation needed)
      if (this.cardBodies[index]) {
        this.cardBodies[index].position.set(
          centeredPosition.x,
          centeredPosition.y,
          centeredPosition.z
        );
      }
    });
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    // Update physics
    this.world.step(1 / 60);

    // Only sync physics if not animating (let GSAP control during animations)
    if (!this.isAnimating) {
      this.cards.forEach((card, index) => {
        const body = this.cardBodies[index];
        if (body) {
          card.position.copy(body.position as any);
          card.quaternion.copy(body.quaternion as any);
        }
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  private createZoomControl(): void {
    // Create zoom control container
    this.zoomControl = document.createElement('div');
    Object.assign(this.zoomControl.style, {
      position: 'fixed',
      bottom: '40px',
      right: '40px',
      width: '2px',
      height: '160px',
      backgroundColor: '#999999',
      zIndex: '1000',
    });

    // Create zoom slider
    this.zoomSlider = document.createElement('div');
    Object.assign(this.zoomSlider.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      backgroundColor: '#999999',
      borderRadius: '50%',
      left: '-5px',
      bottom: '50%',
      cursor: 'pointer',
      transition: 'all 0.1s ease',
    });

    this.zoomControl.appendChild(this.zoomSlider);
    document.body.appendChild(this.zoomControl);

    // Add drag functionality
    this.setupZoomDrag();
  }

  private setupZoomDrag(): void {
    if (!this.zoomSlider || !this.zoomControl) return;

    const startDrag = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      this.isDragging = true;

      // Active state styling
      Object.assign(this.zoomSlider!.style, {
        width: '16px',
        height: '16px',
        left: '-7px',
        backgroundColor: '#cccccc',
      });

      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('touchend', endDrag);
    };

    const drag = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging || !this.zoomControl || !this.zoomSlider) return;

      const rect = this.zoomControl.getBoundingClientRect();
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientY === undefined) return;
      const relativeY = clientY - rect.top;
      const percentage = Math.max(0, Math.min(1, 1 - relativeY / rect.height));

      this.zoomSlider.style.bottom = `${percentage * 100}%`;

      // Update scale (0.5x to 2x range)
      const newScale = 0.5 + percentage * 1.5;
      this.updateScale(newScale);
    };

    const endDrag = () => {
      this.isDragging = false;

      // Inactive state styling
      Object.assign(this.zoomSlider!.style, {
        width: '12px',
        height: '12px',
        left: '-5px',
        backgroundColor: '#999999',
      });

      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('touchend', endDrag);
    };

    this.zoomSlider.addEventListener('mousedown', startDrag);
    this.zoomSlider.addEventListener('touchstart', startDrag);
  }

  private updateScale(newScale: number): void {
    // Just scale the entire scene instead of rebuilding
    this.scene.scale.setScalar(newScale);

    // Update camera frustum to maintain proper view
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10 / newScale; // Inverse scale for frustum

    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  public init(): void {
    // Create test cards
    const testData = this.createTestData();
    testData.forEach((item, index) => {
      const card = this.createCard(item, index);
      this.cards.push(card);
      this.scene.add(card);
    });

    // Initial card positioning handled by smooth system
    this.createZoomControl();
    this.setupEventListeners();
    this.animate();
  }
}

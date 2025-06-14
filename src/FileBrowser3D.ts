import * as THREE from 'three';
import { gsap } from 'gsap';
import * as CANNON from 'cannon-es';

export interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size?: number;
  children?: FileItem[];
  path: string;
}

export class FileBrowser3D {
  // Positioning constants - CRITICAL: these must remain synchronized
  private static readonly CARD_SPACING = 1.5;
  private static readonly DIAGONAL_X_RATIO = -0.5;
  private static readonly DIAGONAL_Y_RATIO = -0.5;
  private static readonly DIAGONAL_Z_RATIO = 0.1;

  private scene: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private world!: CANNON.World;
  private cards: THREE.Group[] = [];
  private cardBodies: CANNON.Body[] = [];
  private currentIndex = 0;
  private isAnimating = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private scrollOffset = 0;

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
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
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

    // Accent lights for depth
    const accentLight1 = new THREE.PointLight(0x00ff88, 0.4, 100);
    accentLight1.position.set(-10, 5, 10);
    this.scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0x0088ff, 0.3, 100);
    accentLight2.position.set(10, 5, -10);
    this.scene.add(accentLight2);
  }

  private createCard(fileItem: FileItem, index: number): THREE.Group {
    const cardGroup = new THREE.Group();

    // Card geometry - 50% smaller, file-shaped
    const cardGeometry = new THREE.BoxGeometry(1.75, 2.25, 0.075);

    // Material based on file type - medium grey for visibility
    const isFolder = fileItem.type === 'folder';
    const cardMaterial = new THREE.MeshPhysicalMaterial({
      color: isFolder ? 0x888888 : 0x777777,
      metalness: 0.1,
      roughness: 0.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
      transmission: 0,
      thickness: 0.5,
    });

    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;

    // Add icon/text (simplified for now)
    const iconGeometry = new THREE.PlaneGeometry(0.5, 0.5);
    const iconMaterial = new THREE.MeshBasicMaterial({
      color: isFolder ? 0x00ff88 : 0x0088ff,
      transparent: true,
      opacity: 0.8,
    });
    const iconMesh = new THREE.Mesh(iconGeometry, iconMaterial);
    iconMesh.position.z = 0.06;

    // Rotate card to counteract isometric camera perspective
    cardGroup.rotation.z = 0; // No left/right tilt - keep flat
    cardGroup.rotation.x = 0.1; // Slight forward lean
    cardGroup.rotation.y = 0; // Reset rotation for perspective camera test

    cardGroup.add(cardMesh);
    cardGroup.add(iconMesh);

    // Position cards in diagonal formation (top-left to bottom-right)
    const diagonalOffset = index * FileBrowser3D.CARD_SPACING;
    cardGroup.position.set(
      diagonalOffset * FileBrowser3D.DIAGONAL_X_RATIO,
      -diagonalOffset * FileBrowser3D.DIAGONAL_Y_RATIO,
      -diagonalOffset * FileBrowser3D.DIAGONAL_Z_RATIO
    );

    // Add physics body with no mass (kinematic) - smaller size
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
    this.canvas.addEventListener('touchstart', event => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    });

    this.canvas.addEventListener('touchmove', event => {
      event.preventDefault();
    });

    this.canvas.addEventListener('touchend', event => {
      event.preventDefault();
      if (event.changedTouches.length === 0) return;

      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;

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

    const newIndex = Math.max(
      0,
      Math.min(this.cards.length - 1, this.currentIndex + direction)
    );
    if (newIndex === this.currentIndex) return;

    this.currentIndex = newIndex;
    this.isAnimating = true;

    // Smooth scroll offset animation
    this.scrollOffset += direction;

    // Calculate positions relative to selected card to keep it centered
    const selectedBasePosition = {
      x:
        this.currentIndex *
        FileBrowser3D.CARD_SPACING *
        FileBrowser3D.DIAGONAL_X_RATIO,
      y:
        -(this.currentIndex * FileBrowser3D.CARD_SPACING) *
        FileBrowser3D.DIAGONAL_Y_RATIO,
      z:
        -(this.currentIndex * FileBrowser3D.CARD_SPACING) *
        FileBrowser3D.DIAGONAL_Z_RATIO,
    };

    // Animate all cards with smooth easing
    this.cards.forEach((card, index) => {
      const isSelected = index === this.currentIndex;
      const scale = isSelected ? 1.15 : 1.0;
      const basePosition = {
        x: index * FileBrowser3D.CARD_SPACING * FileBrowser3D.DIAGONAL_X_RATIO,
        y:
          -(index * FileBrowser3D.CARD_SPACING) *
          FileBrowser3D.DIAGONAL_Y_RATIO,
        z:
          -(index * FileBrowser3D.CARD_SPACING) *
          FileBrowser3D.DIAGONAL_Z_RATIO,
      };

      // Position relative to selected card (keeps selected card centered)
      const centeredPosition = {
        x: basePosition.x - selectedBasePosition.x,
        y: basePosition.y - selectedBasePosition.y,
        z: basePosition.z - selectedBasePosition.z,
      };

      // Selected card gets a lift
      if (isSelected) {
        centeredPosition.y += 0.8;
        centeredPosition.z += 0.3;
      }

      // Smooth animations with responsive easing - 3x faster
      gsap.to(card.scale, {
        x: scale,
        y: scale,
        z: scale,
        duration: 0.2,
        ease: 'power2.out',
      });

      gsap.to(card.position, {
        x: centeredPosition.x,
        y: centeredPosition.y,
        z: centeredPosition.z,
        duration: 0.27,
        ease: 'power2.out',
      });

      // Update physics body position
      if (this.cardBodies[index]) {
        gsap.to(this.cardBodies[index].position, {
          x: centeredPosition.x,
          y: centeredPosition.y,
          z: centeredPosition.z,
          duration: 0.27,
          ease: 'power2.out',
          onComplete: () => {
            if (index === this.currentIndex) {
              this.isAnimating = false;
            }
          },
        });
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

  public init(): void {
    // Create test cards
    const testData = this.createTestData();
    testData.forEach((item, index) => {
      const card = this.createCard(item, index);
      this.cards.push(card);
      this.scene.add(card);
    });

    // Highlight first card
    const firstCard = this.cards[0];
    if (firstCard) {
      firstCard.scale.setScalar(1.1);
      firstCard.position.y += 0.5;
    }

    this.setupEventListeners();
    this.animate();
  }
}

import * as THREE from 'three';
import { gsap } from 'gsap';

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
  private static readonly fileColor = 0xaaaaaa;
  private static readonly cornerRadius = 0.05;
  private static readonly cardThickness = 0.075;

  private scene: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private cards: THREE.Group[] = [];
  private scrollPosition = 0;
  private isAnimating = false;
  private zoomControl: HTMLElement | null = null;
  private zoomSlider: HTMLElement | null = null;
  private isDragging = false;
  private currentZoom = 1.1;
  private readonly MIN_ZOOM = 0.7;
  private readonly MAX_ZOOM = 1.5;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.setupCamera();
    this.setupRenderer();
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

  private createCardGeometry(isFolder: boolean): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const r = FileBrowser3D.cornerRadius;

    if (isFolder) {
      // Create unified folder shape (body + tab)
      const w = FileBrowser3D.folderWidth;
      const h = FileBrowser3D.folderHeight;
      const tw = FileBrowser3D.tabWidth;
      const th = FileBrowser3D.tabHeight;

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
    } else {
      // Create simple rounded rectangle for files
      const w = FileBrowser3D.fileWidth;
      const h = FileBrowser3D.fileHeight;

      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    }

    const extrudeSettings = {
      depth: FileBrowser3D.cardThickness - FileBrowser3D.cornerRadius * 2,
      bevelEnabled: true,
      bevelSize: FileBrowser3D.cornerRadius,
      bevelThickness: FileBrowser3D.cornerRadius,
      bevelSegments: 5,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
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

  private addTextToCard(
    cardGroup: THREE.Group,
    text: string,
    isFolder: boolean
  ): void {
    // Create canvas for text texture
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;

    // Clear canvas
    context.fillStyle = 'transparent';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.fillStyle = 'white';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Truncate long text
    const maxLength = isFolder ? 12 : 15;
    const displayText =
      text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    context.fillText(displayText, canvas.width / 2, canvas.height / 2);

    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const textMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
    });

    // Create text plane
    const textGeometry = new THREE.PlaneGeometry(1.5, 0.3);
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    // Position text
    if (isFolder) {
      // Position on folder tab (original working position)
      textMesh.position.set(
        -FileBrowser3D.folderWidth / 4,
        FileBrowser3D.folderHeight / 2 + FileBrowser3D.tabHeight / 2,
        FileBrowser3D.cardThickness / 2 + 0.01
      );
    } else {
      // Position on top of file card - center like folders were originally
      textMesh.position.set(
        0,
        FileBrowser3D.fileHeight / 2 - 0.2,
        FileBrowser3D.cardThickness / 2 + 0.01
      );
    }

    cardGroup.add(textMesh);
  }

  private createCard(fileItem: FileItem, index: number): THREE.Group {
    const cardGroup = new THREE.Group();

    // Card geometry based on type
    const isFolder = fileItem.type === 'folder';
    const cardGeometry = this.createCardGeometry(isFolder);

    const cardMaterial = this.createCardMaterial(isFolder);

    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;

    cardGroup.add(cardMesh);

    // Add text label
    this.addTextToCard(cardGroup, fileItem.name, isFolder);

    // Position cards in a diagonal row (top-left to bottom-right)
    const diagonalOffset = index * FileBrowser3D.CARD_SPACING;
    cardGroup.position.set(
      diagonalOffset * FileBrowser3D.DIAGONAL_X_RATIO,
      -diagonalOffset * FileBrowser3D.DIAGONAL_Y_RATIO,
      -diagonalOffset * FileBrowser3D.DIAGONAL_Z_RATIO
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
    // Mouse wheel for navigation and trackpad pinch
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();

      if (event.ctrlKey) {
        // Trackpad pinch gesture
        const zoomDelta = -event.deltaY * 0.01;
        this.setZoom(this.currentZoom + zoomDelta);
      } else {
        // Regular wheel scrolling for navigation
        if (this.isAnimating) return;

        // Support both vertical and horizontal scrolling
        const verticalDelta = -Math.sign(event.deltaY); // Negative so down-scroll moves forward
        const horizontalDelta = -Math.sign(event.deltaX); // Negative so left-scroll moves forward

        // Use whichever direction has movement
        const delta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? horizontalDelta
            : verticalDelta;

        if (delta !== 0) {
          this.navigateCards(delta);
        }
      }
    });

    // Touch events for mobile - continuous drag navigation
    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;
    let startScrollPosition = 0;
    let lastTouchTime = 0;
    let lastTouchPosition = 0;
    let velocity = 0;

    this.canvas.addEventListener('touchstart', event => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;

      // Cancel any running snap animation
      gsap.killTweensOf(this);
      this.isAnimating = false;

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isDragging = true;
      startScrollPosition = this.scrollPosition;
      lastTouchTime = Date.now();
      lastTouchPosition = this.scrollPosition;
      velocity = 0;
    });

    this.canvas.addEventListener('touchmove', event => {
      event.preventDefault();
      if (!isDragging) return;

      const touch = event.touches[0];
      if (!touch) return;

      // Calculate total drag distance from start
      const totalDeltaX = touch.clientX - touchStartX;
      const totalDeltaY = touch.clientY - touchStartY;

      // Use true diagonal distance for 1:1 tracking
      const diagonalDistance = Math.hypot(totalDeltaX, totalDeltaY);

      // Determine direction: positive if primarily right/down, negative if left/up
      const primaryDelta =
        Math.abs(totalDeltaX) > Math.abs(totalDeltaY)
          ? totalDeltaX
          : totalDeltaY;
      const direction = Math.sign(primaryDelta);

      // Convert drag distance to scroll position (100px = 1 card position)
      // Positive drag (right/down) = forward, negative drag (left/up) = backward
      const scrollDelta = (diagonalDistance * direction) / 100;

      // Calculate new scroll position relative to start
      const newScrollPosition = Math.max(
        0,
        Math.min(this.cards.length - 1, startScrollPosition + scrollDelta)
      );

      // Update scroll position in real-time (skip animations during drag)
      this.scrollPosition = newScrollPosition;
      this.updateCardPositionsImmediate();

      // Calculate velocity for momentum
      const currentTime = Date.now();
      const timeDelta = currentTime - lastTouchTime;
      if (timeDelta > 0) {
        const positionDelta = newScrollPosition - lastTouchPosition;
        velocity = positionDelta / timeDelta; // positions per millisecond
        lastTouchTime = currentTime;
        lastTouchPosition = newScrollPosition;
      }
    });

    this.canvas.addEventListener('touchend', event => {
      event.preventDefault();
      isDragging = false;

      // Calculate momentum-based final position
      const momentumDistance = velocity * 300; // Momentum duration in ms
      const targetPosition = this.scrollPosition + momentumDistance;

      // Clamp to valid range and snap to nearest whole position
      const clampedTarget = Math.max(
        0,
        Math.min(this.cards.length - 1, targetPosition)
      );
      const snappedPosition = Math.round(clampedTarget);

      // Animate to final position with momentum
      const distance = Math.abs(snappedPosition - this.scrollPosition);
      const duration = Math.max(0.1, Math.min(1.0, distance * 0.2 + 0.1)); // Variable duration based on distance

      this.isAnimating = true;
      gsap.to(this, {
        scrollPosition: snappedPosition,
        duration: duration,
        ease: 'power2.out',
        onUpdate: () => this.updateCardPositions(),
        onComplete: () => {
          this.isAnimating = false;
        },
      });
    });

    // Keyboard controls for zoom
    window.addEventListener('keydown', event => {
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        this.setZoom(this.currentZoom + 0.1);
      } else if (event.key === '-') {
        event.preventDefault();
        this.setZoom(this.currentZoom - 0.1);
      } else if (event.key === '0') {
        event.preventDefault();
        this.setZoom(1.0); // Reset to default zoom
      }
    });

    // Pinch-to-zoom for mobile
    let initialDistance = 0;
    let initialZoom = 1.0;

    this.canvas.addEventListener('touchstart', event => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        if (touch1 && touch2) {
          initialDistance = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
          );
          initialZoom = this.currentZoom;
        }
      }
    });

    this.canvas.addEventListener('touchmove', event => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        if (touch1 && touch2) {
          const currentDistance = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
          );
          const scale = currentDistance / initialDistance;
          this.setZoom(initialZoom * scale);
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

  private createZoomControl(): void {
    // Create zoom control container with larger clickable area
    this.zoomControl = document.createElement('div');
    Object.assign(this.zoomControl.style, {
      position: 'fixed',
      top: '40px',
      right: '40px',
      width: '24px', // Wider clickable area (16px slider diameter * 1.5 = 24px)
      height: '160px',
      zIndex: '1000',
      cursor: 'pointer',
    });

    // Create visible track (thin line)
    const track = document.createElement('div');
    Object.assign(track.style, {
      position: 'absolute',
      left: '9px', // Center the 2px line in 20px container
      top: '0',
      width: '2px',
      height: '100%',
      backgroundColor: '#999999',
      pointerEvents: 'none',
    });

    this.zoomControl.appendChild(track);

    // Create zoom slider
    this.zoomSlider = document.createElement('div');
    Object.assign(this.zoomSlider.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      backgroundColor: '#999999',
      borderRadius: '50%',
      left: '4px', // Center in 20px container (10px - 6px = 4px)
      bottom: '50%',
      cursor: 'pointer',
      transition: 'all 0.1s ease',
      pointerEvents: 'none', // Let container handle clicks
    });

    this.zoomControl.appendChild(this.zoomSlider);
    document.body.appendChild(this.zoomControl);

    // Add drag functionality
    this.setupZoomDrag();

    // Initialize slider position
    this.updateSliderPosition();
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
        left: '2px', // Adjust for larger size in 20px container
        backgroundColor: '#cccccc',
      });

      // If clicked directly on track (not during drag), jump to that position
      if (e.type === 'mousedown' || e.type === 'touchstart') {
        const rect = this.zoomControl!.getBoundingClientRect();
        const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
        if (clientY !== undefined) {
          const relativeY = clientY - rect.top;
          const percentage = Math.max(
            0,
            Math.min(1, 1 - relativeY / rect.height)
          );
          const newScale =
            this.MIN_ZOOM + percentage * (this.MAX_ZOOM - this.MIN_ZOOM);
          this.setZoom(newScale);
        }
      }

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

      // Update scale with limits and finer increments
      const newScale =
        this.MIN_ZOOM + percentage * (this.MAX_ZOOM - this.MIN_ZOOM);
      this.setZoom(newScale);
    };

    const endDrag = () => {
      this.isDragging = false;

      // Inactive state styling
      Object.assign(this.zoomSlider!.style, {
        width: '12px',
        height: '12px',
        left: '4px', // Center in 20px container
        backgroundColor: '#999999',
      });

      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('touchend', endDrag);
    };

    this.zoomControl.addEventListener('mousedown', startDrag);
    this.zoomControl.addEventListener('touchstart', startDrag);
  }

  private setZoom(targetZoom: number): void {
    // Clamp zoom to limits
    targetZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, targetZoom));

    // Snap to 1.0 if close (within 0.05)
    if (Math.abs(targetZoom - 1.0) < 0.05) {
      targetZoom = 1.0;
    }

    // Smooth zoom transition
    gsap.to(this, {
      currentZoom: targetZoom,
      duration: 0.15,
      ease: 'power2.out',
      onUpdate: () => this.updateScale(),
    });
  }

  private updateScale(): void {
    // Apply current zoom to scene
    this.scene.scale.setScalar(this.currentZoom);

    // Update camera frustum to maintain proper view
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10 / this.currentZoom;

    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();

    this.updateSliderPosition();
  }

  private updateSliderPosition(): void {
    if (!this.zoomSlider) return;
    const percentage =
      (this.currentZoom - this.MIN_ZOOM) / (this.MAX_ZOOM - this.MIN_ZOOM);
    this.zoomSlider.style.bottom = `${percentage * 100}%`;
  }

  public init(): void {
    const testData = this.createTestData();
    testData.forEach((item, index) => {
      const card = this.createCard(item, index);
      this.cards.push(card);
      this.scene.add(card);
    });

    this.createZoomControl();
    this.setupEventListeners();
    this.updateScale();
    this.animate();
  }
}

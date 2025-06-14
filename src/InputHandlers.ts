import * as THREE from 'three';
import { gsap } from 'gsap';

export class InputHandlers {
  private isAnimating = false;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private activeAnimations: gsap.core.Tween[] = [];
  private lastInputTime = 0;
  private readonly INPUT_DEBOUNCE = 50; // ms
  private lastClickTime = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private cards: THREE.Group[],
    private camera: THREE.Camera,
    private scrollPosition: () => number,
    private setScrollPosition: (pos: number) => void,
    private updateCardPositions: () => void,
    private updateCardPositionsImmediate: () => void,
    private navigateCards: (direction: number) => void,
    private setZoom: (zoom: number) => void,
    private getCurrentZoom: () => number,
    private animationDuration: number
  ) {}

  setupEventListeners(): void {
    this.setupMouseWheel();
    this.setupTouchNavigation();
    this.setupKeyboard();
    this.setupPinchZoom();
    this.setupClickTap();
    this.setupWindowResize();
  }

  private setupMouseWheel(): void {
    // Mouse wheel for navigation and trackpad pinch
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();

      if (event.ctrlKey) {
        // Trackpad pinch gesture
        const zoomDelta = -event.deltaY * 0.01;
        this.setZoom(this.getCurrentZoom() + zoomDelta);
      } else {
        // Regular wheel scrolling for navigation
        const now = Date.now();
        if (this.isAnimating || now - this.lastInputTime < this.INPUT_DEBOUNCE)
          return;

        this.lastInputTime = now;

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
  }

  private setupTouchNavigation(): void {
    // Touch events for mobile - continuous drag navigation and tap detection
    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;
    let startScrollPosition = 0;
    let lastTouchTime = 0;
    let lastTouchPosition = 0;
    let velocity = 0;
    let touchStartTime = 0;
    let hasMoved = false;

    this.canvas.addEventListener('touchstart', event => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;

      // Cancel any running animations
      this.cancelAnimations();

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isDragging = true;
      startScrollPosition = this.scrollPosition();
      lastTouchTime = Date.now();
      lastTouchPosition = this.scrollPosition();
      velocity = 0;
      touchStartTime = Date.now();
      hasMoved = false;
    });

    this.canvas.addEventListener('touchmove', event => {
      event.preventDefault();
      if (!isDragging) return;

      const touch = event.touches[0];
      if (!touch) return;

      // Calculate total drag distance from start
      const totalDeltaX = touch.clientX - touchStartX;
      const totalDeltaY = touch.clientY - touchStartY;

      // Check if this is significant movement (tap vs drag detection)
      const moveDistance = Math.hypot(totalDeltaX, totalDeltaY);
      if (moveDistance > 15) {
        hasMoved = true;
      }

      // Only do drag navigation if there's been significant movement
      if (!hasMoved) return;

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
      this.setScrollPosition(newScrollPosition);
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

      // Check if this was a tap (no movement and quick)
      const touchDuration = Date.now() - touchStartTime;
      if (!hasMoved && touchDuration < 300) {
        // This was a tap - handle click to center
        const touch = event.changedTouches[0];
        if (touch) {
          this.handleCardClick(touch.clientX, touch.clientY);
        }
        return;
      }

      // This was a drag - handle momentum only if there was movement
      if (hasMoved) {
        // Calculate momentum-based final position
        const momentumDistance = velocity * 300; // Momentum duration in ms
        const targetPosition = this.scrollPosition() + momentumDistance;

        // Clamp to valid range and snap to nearest whole position
        const clampedTarget = Math.max(
          0,
          Math.min(this.cards.length - 1, targetPosition)
        );
        const snappedPosition = Math.round(clampedTarget);

        // Animate to final position with momentum
        const distance = Math.abs(snappedPosition - this.scrollPosition());
        const duration = Math.max(0.1, Math.min(1.0, distance * 0.2 + 0.1));

        this.cancelAnimations();
        this.isAnimating = true;

        const currentPos = this.scrollPosition();
        const animationObj = { pos: currentPos };
        const tween = gsap.to(animationObj, {
          pos: snappedPosition,
          duration: duration,
          ease: 'power2.out',
          onUpdate: () => {
            this.setScrollPosition(animationObj.pos);
            this.updateCardPositions();
          },
          onComplete: () => {
            this.isAnimating = false;
            this.removeAnimation(tween);
          },
        });
        this.activeAnimations.push(tween);
      }
    });
  }

  private setupKeyboard(): void {
    // Keyboard controls for zoom
    window.addEventListener('keydown', event => {
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        this.setZoom(this.getCurrentZoom() + 0.1);
      } else if (event.key === '-') {
        event.preventDefault();
        this.setZoom(this.getCurrentZoom() - 0.1);
      } else if (event.key === '0') {
        event.preventDefault();
        this.setZoom(1.0); // Reset to default zoom
      }
    });
  }

  private setupPinchZoom(): void {
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
          initialZoom = this.getCurrentZoom();
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
  }

  private setupClickTap(): void {
    // Click/tap to center cards (desktop only)
    this.canvas.addEventListener('click', event => {
      this.handleCardClick(event.clientX, event.clientY);
    });

    // Mobile tap detection is handled in setupTouchNavigation()
  }

  private setupWindowResize(): void {
    // Window resize
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      const frustumSize = 10;

      if (this.camera instanceof THREE.OrthographicCamera) {
        this.camera.left = (-frustumSize * aspect) / 2;
        this.camera.right = (frustumSize * aspect) / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();
      }

      // Note: renderer resize should be handled by parent class
    });
  }

  private handleCardClick(clientX: number, clientY: number): void {
    const now = Date.now();
    // Only debounce if very recent click, allow clicks during scroll animations
    if (now - this.lastClickTime < 100) return;

    this.lastClickTime = now;

    // Convert mouse/touch coordinates to normalized device coordinates
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    // Set up raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Get all meshes from all cards for intersection testing
    const intersectObjects: THREE.Object3D[] = [];
    this.cards.forEach(card => {
      card.traverse(child => {
        if (child instanceof THREE.Mesh) {
          intersectObjects.push(child);
        }
      });
    });

    // Find intersections
    const intersects = this.raycaster.intersectObjects(intersectObjects);

    if (intersects.length > 0) {
      // Find the card group that contains the clicked mesh
      let clickedCard: THREE.Group | null = null;
      let parent = intersects[0]?.object?.parent;

      while (parent && !clickedCard) {
        if (
          parent instanceof THREE.Group &&
          parent.userData['index'] !== undefined
        ) {
          clickedCard = parent;
        }
        parent = parent?.parent;
      }

      if (clickedCard && clickedCard.userData['index'] !== undefined) {
        this.centerCard(clickedCard.userData['index']);
      }
    }
  }

  private centerCard(targetIndex: number): void {
    if (this.isAnimating || targetIndex === this.scrollPosition()) return;

    this.cancelAnimations();
    this.isAnimating = true;

    // Animate to center the clicked card
    const currentPos = this.scrollPosition();
    const animationObj = { pos: currentPos };
    const tween = gsap.to(animationObj, {
      pos: targetIndex,
      duration: this.animationDuration * 4,
      ease: 'power2.out',
      onUpdate: () => {
        this.setScrollPosition(animationObj.pos);
        this.updateCardPositions();
      },
      onComplete: () => {
        this.isAnimating = false;
        this.removeAnimation(tween);
      },
    });
    this.activeAnimations.push(tween);
  }

  setAnimating(animating: boolean): void {
    this.isAnimating = animating;
  }

  getAnimating(): boolean {
    return this.isAnimating;
  }

  cancelAnimations(): void {
    // Kill all active animations
    this.activeAnimations.forEach(tween => tween.kill());
    this.activeAnimations = [];
    this.isAnimating = false;
  }

  private removeAnimation(tween: gsap.core.Tween): void {
    const index = this.activeAnimations.indexOf(tween);
    if (index > -1) {
      this.activeAnimations.splice(index, 1);
    }
  }
}

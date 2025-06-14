import * as THREE from 'three';
import { gsap } from 'gsap';

export class ZoomControls {
  private zoomControl: HTMLElement | null = null;
  private zoomSlider: HTMLElement | null = null;
  private zoomTrack: HTMLElement | null = null;
  private isDragging = false;
  private currentZoom = 1.1;
  private readonly MIN_ZOOM = 0.7;
  private readonly MAX_ZOOM = 1.5;
  private fadeTimeout: NodeJS.Timeout | null = null;
  private trackRestingOpacity = '0.2';
  private sliderRestingOpacity = '0.5';

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.OrthographicCamera,
    private onZoomChange?: () => void
  ) {}

  createZoomControl(): void {
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
    this.zoomTrack = document.createElement('div');
    Object.assign(this.zoomTrack.style, {
      position: 'absolute',
      left: '9px', // Center the 2px line in 20px container
      top: '0',
      width: '2px',
      height: '100%',
      backgroundColor: '#999999',
      opacity: this.trackRestingOpacity,
      transition: 'opacity 0.5s ease',
      pointerEvents: 'none',
    });

    this.zoomControl.appendChild(this.zoomTrack);

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
      opacity: this.sliderRestingOpacity,
      transition: 'all 0.1s ease, opacity 0.5s ease',
      pointerEvents: 'none', // Let container handle clicks
    });

    this.zoomControl.appendChild(this.zoomSlider);
    document.body.appendChild(this.zoomControl);

    this.setupZoomDrag();

    // Initialize slider position
    this.updateSliderPosition();
  }

  private setupZoomDrag(): void {
    if (!this.zoomSlider || !this.zoomControl) return;

    const startDrag = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      this.isDragging = true;

      if (this.fadeTimeout) {
        clearTimeout(this.fadeTimeout);
        this.fadeTimeout = null;
      }

      Object.assign(this.zoomSlider!.style, {
        width: '16px',
        height: '16px',
        left: '2px', // Adjust for larger size in 20px container
        backgroundColor: '#cccccc',
        opacity: '1.0',
      });

      if (this.zoomTrack) {
        this.zoomTrack.style.opacity = '1.0';
      }

      // Jump to position when user clicks on track
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

    const drag = (e: MouseEvent | TouchEvent): void => {
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

    const endDrag = (): void => {
      this.isDragging = false;

      // Inactive state styling (but keep full opacity for now)
      Object.assign(this.zoomSlider!.style, {
        width: '12px',
        height: '12px',
        left: '4px', // Center in 20px container
        backgroundColor: '#999999',
      });

      this.fadeTimeout = setTimeout(() => {
        if (this.zoomSlider && !this.isDragging) {
          this.zoomSlider.style.opacity = this.sliderRestingOpacity;
        }
        if (this.zoomTrack && !this.isDragging) {
          this.zoomTrack.style.opacity = this.trackRestingOpacity;
        }
        this.fadeTimeout = null;
      }, 1000);

      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('touchend', endDrag);
    };

    this.zoomControl.addEventListener('mousedown', startDrag);
    this.zoomControl.addEventListener('touchstart', startDrag);
  }

  setZoom(targetZoom: number): void {
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

    // Notify parent if callback provided
    if (this.onZoomChange) {
      this.onZoomChange();
    }
  }

  private updateSliderPosition(): void {
    if (!this.zoomSlider) return;
    const percentage =
      (this.currentZoom - this.MIN_ZOOM) / (this.MAX_ZOOM - this.MIN_ZOOM);
    this.zoomSlider.style.bottom = `${percentage * 100}%`;
  }

  getCurrentZoom(): number {
    return this.currentZoom;
  }

  getZoomLimits(): { min: number; max: number } {
    return { min: this.MIN_ZOOM, max: this.MAX_ZOOM };
  }
}

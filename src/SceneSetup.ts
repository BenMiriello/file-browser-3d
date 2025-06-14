import * as THREE from 'three';

export class SceneSetup {
  static setupCamera(): THREE.OrthographicCamera {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;

    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );

    // Position camera isometrically from above and to the left
    camera.position.set(-8, 8, 8);
    camera.lookAt(0, 0, 0);

    return camera;
  }

  static setupRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    return renderer;
  }

  static setupLighting(scene: THREE.Scene): void {
    // Ambient light for overall illumination (increased slightly)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

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
    scene.add(directionalLight);

    // Fill light from top-left for more natural lighting
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(-15, 15, 10);
    scene.add(fillLight);

    // Accent lights for depth
    const accentLight1 = new THREE.PointLight(0x00ff88, 0.5, 100);
    accentLight1.position.set(-10, 5, 10);
    scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0x0088ff, 0.5, 100);
    accentLight2.position.set(10, 5, -10);
    scene.add(accentLight2);
  }
}

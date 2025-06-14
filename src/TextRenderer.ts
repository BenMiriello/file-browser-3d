import * as THREE from 'three';
import { CardGeometry } from './CardGeometry';

export class TextRenderer {
  static addTextToCard(
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
        -CardGeometry.folderWidth / 4,
        CardGeometry.folderHeight / 2 + CardGeometry.tabHeight / 2,
        CardGeometry.cardThickness / 2 + 0.01
      );
    } else {
      // Position on top of file card - center like folders were originally
      textMesh.position.set(
        0,
        CardGeometry.fileHeight / 2 - 0.2,
        CardGeometry.cardThickness / 2 + 0.01
      );
    }

    cardGroup.add(textMesh);
  }
}

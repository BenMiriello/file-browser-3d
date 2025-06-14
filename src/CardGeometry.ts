import * as THREE from 'three';
import type { FileItem } from './FileBrowser3D';

export class CardGeometry {
  // Geometry constants
  static readonly folderWidth = 2.25;
  static readonly folderHeight = 1.75;
  static readonly tabHeight = 0.5;
  static readonly tabWidth = CardGeometry.folderWidth * (2 / 3);
  static readonly fileWidth = 2;
  static readonly fileHeight = 2.25;
  static readonly folderColor = 0x707070;
  static readonly fileColor = 0xaaaaaa;
  static readonly cornerRadius = 0.05;
  static readonly cardThickness = 0.075;

  static createCardGeometry(isFolder: boolean): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const r = CardGeometry.cornerRadius;

    if (isFolder) {
      // Create unified folder shape (body + tab)
      const w = CardGeometry.folderWidth;
      const h = CardGeometry.folderHeight;
      const tw = CardGeometry.tabWidth;
      const th = CardGeometry.tabHeight;

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
      const w = CardGeometry.fileWidth;
      const h = CardGeometry.fileHeight;

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
      depth: CardGeometry.cardThickness - CardGeometry.cornerRadius * 2,
      bevelEnabled: true,
      bevelSize: CardGeometry.cornerRadius,
      bevelThickness: CardGeometry.cornerRadius,
      bevelSegments: 5,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  static createCardMaterial(isFolder: boolean): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: isFolder ? CardGeometry.folderColor : CardGeometry.fileColor,
      metalness: 0.25,
      roughness: 0.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
      transmission: 0,
      thickness: 0.5,
    });
  }

  static createCard(
    fileItem: FileItem,
    index: number,
    cardSpacing: number,
    diagonalRatios: { x: number; y: number; z: number }
  ): THREE.Group {
    const cardGroup = new THREE.Group();

    // Card geometry based on type
    const isFolder = fileItem.type === 'folder';
    const cardGeometry = CardGeometry.createCardGeometry(isFolder);
    const cardMaterial = CardGeometry.createCardMaterial(isFolder);

    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;

    cardGroup.add(cardMesh);

    // Store index for click detection
    cardGroup.userData = { index };

    // Position cards in a diagonal row (top-left to bottom-right)
    const diagonalOffset = index * cardSpacing;
    cardGroup.position.set(
      diagonalOffset * diagonalRatios.x,
      -diagonalOffset * diagonalRatios.y,
      -diagonalOffset * diagonalRatios.z
    );

    return cardGroup;
  }
}

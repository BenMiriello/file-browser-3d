import * as THREE from 'three';
import { FileItem } from '../FileBrowser3D';

export interface TransitionContext {
  scene: THREE.Scene;
  currentCards: THREE.Group[];
  newCards: THREE.Group[];
  selectedFolder: FileItem;
  selectedCardIndex: number;
}

export interface ITransition {
  /**
   * Execute the transition animation
   * @param context - The transition context containing cards and scene info
   * @returns Promise that resolves when animation completes
   */
  execute(context: TransitionContext): Promise<void>;

  /**
   * Cancel the current animation if running
   */
  cancel(): void;

  /**
   * Get the duration of this transition in seconds
   */
  getDuration(): number;

  /**
   * Get the name identifier for this transition
   */
  getName(): string;
}

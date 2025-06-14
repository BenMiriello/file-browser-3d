import { ITransition, TransitionContext } from './ITransition';
import { DropAndFanTransition } from './DropAndFanTransition';

export type TransitionType = 'dropAndFan';

export class AnimationManager {
  private transitions: Map<TransitionType, ITransition> = new Map();
  private currentTransition: ITransition | undefined;

  constructor() {
    this.registerTransition('dropAndFan', new DropAndFanTransition());
  }

  /**
   * Register a new transition type
   */
  public registerTransition(
    type: TransitionType,
    transition: ITransition
  ): void {
    this.transitions.set(type, transition);
  }

  /**
   * Execute a transition animation
   */
  public async executeTransition(
    type: TransitionType,
    context: TransitionContext
  ): Promise<void> {
    // Cancel any running transition
    if (this.currentTransition) {
      this.currentTransition.cancel();
    }

    const transition = this.transitions.get(type);
    if (!transition) {
      throw new Error(`Transition type '${type}' not found`);
    }

    this.currentTransition = transition;
    await transition.execute(context);
    this.currentTransition = undefined as ITransition | undefined;
  }

  /**
   * Cancel current transition
   */
  public cancelCurrentTransition(): void {
    if (this.currentTransition) {
      this.currentTransition.cancel();
      this.currentTransition = undefined as ITransition | undefined;
    }
  }

  /**
   * Check if any transition is currently running
   */
  public isAnimating(): boolean {
    return this.currentTransition !== undefined;
  }

  /**
   * Get available transition types
   */
  public getAvailableTransitions(): TransitionType[] {
    return Array.from(this.transitions.keys());
  }
}

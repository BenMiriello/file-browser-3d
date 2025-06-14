import { gsap } from 'gsap';
import { ITransition, TransitionContext } from './ITransition';

export abstract class BaseTransition implements ITransition {
  protected isAnimating = false;
  protected currentTween: gsap.core.Timeline | undefined;

  abstract execute(context: TransitionContext): Promise<void>;
  abstract getDuration(): number;
  abstract getName(): string;

  public cancel(): void {
    if (this.currentTween) {
      this.currentTween.kill();
      this.currentTween = undefined as gsap.core.Timeline | undefined;
    }
    this.isAnimating = false;
  }

  protected createTimeline(): gsap.core.Timeline {
    this.cancel(); // Cancel any existing animation
    this.isAnimating = true;
    this.currentTween = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        this.currentTween = undefined as gsap.core.Timeline | undefined;
      },
    });
    return this.currentTween;
  }

  protected finishAnimation(): Promise<void> {
    return new Promise(resolve => {
      if (this.currentTween) {
        this.currentTween.then(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

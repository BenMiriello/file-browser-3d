import { BaseTransition } from './BaseTransition';
import { TransitionContext } from './ITransition';

export class DropAndFanTransition extends BaseTransition {
  private static readonly DURATION = 1.2;
  private static readonly DROP_DISTANCE = 3.0;

  public getName(): string {
    return 'dropAndFan';
  }

  public getDuration(): number {
    return DropAndFanTransition.DURATION;
  }

  public async execute(context: TransitionContext): Promise<void> {
    const timeline = this.createTimeline();
    const selectedCard = context.currentCards[context.selectedCardIndex];

    if (!selectedCard) {
      return;
    }

    // Store original positions for current cards
    const originalPositions = context.currentCards.map(card => ({
      x: card.position.x,
      y: card.position.y,
      z: card.position.z,
      scaleX: card.scale.x,
      scaleY: card.scale.y,
      scaleZ: card.scale.z,
    }));

    // Phase 1: Drop current cards (0.0s - 0.6s)
    timeline.to(
      context.currentCards.map(card => card.position),
      {
        y: i =>
          (originalPositions[i]?.y ?? 0) - DropAndFanTransition.DROP_DISTANCE,
        duration: 0.6,
        ease: 'power2.in',
        stagger: 0.05,
      },
      0
    );

    // Fade out current cards during drop
    timeline.to(
      context.currentCards.map(card => card.scale),
      {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.4,
        ease: 'power2.in',
        stagger: 0.03,
      },
      0.2
    );

    // Phase 2: Calculate final diagonal positions for new cards
    const finalPositions = this.calculateDiagonalPositions(
      context.newCards.length,
      0 // Start with first card centered
    );

    // Set initial positions for new cards (stacked at selected card position)
    context.newCards.forEach(card => {
      card.position.copy(selectedCard.position);
      card.scale.set(0, 0, 0);
      context.scene.add(card);
    });

    // Phase 3: Move new cards to proper diagonal positions (0.6s - 1.2s)
    timeline.to(
      context.newCards.map(card => card.position),
      {
        x: i => finalPositions[i]?.x ?? 0,
        y: i => finalPositions[i]?.y ?? 0,
        z: i => finalPositions[i]?.z ?? 0,
        duration: 0.6,
        ease: 'back.out(1.7)',
        stagger: 0.08,
      },
      0.6
    );

    // Scale up new cards as they move to diagonal positions
    timeline.to(
      context.newCards.map(card => card.scale),
      {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.5,
        ease: 'back.out(1.2)',
        stagger: 0.06,
      },
      0.7
    );

    return this.finishAnimation();
  }

  private calculateDiagonalPositions(
    cardCount: number,
    scrollPosition: number = 0
  ): Array<{ x: number; y: number; z: number }> {
    const positions: Array<{ x: number; y: number; z: number }> = [];

    // Use the same constants as FileBrowser3D for consistency
    const CARD_SPACING = 1.5;
    const DIAGONAL_X_RATIO = -0.5;
    const DIAGONAL_Y_RATIO = -0.5;
    const DIAGONAL_Z_RATIO = 0.1;

    for (let i = 0; i < cardCount; i++) {
      // Calculate smooth distance from scroll center (first card is centered)
      const distanceFromCenter = Math.abs(i - scrollPosition);

      // Smooth elevation interpolation (0 to 0.6 at center, drops off smoothly)
      const elevation = 0.6 * Math.max(0, 1 - distanceFromCenter);

      // Calculate position using the same logic as FileBrowser3D
      positions.push({
        x: (i - scrollPosition) * CARD_SPACING * DIAGONAL_X_RATIO,
        y: -(i - scrollPosition) * CARD_SPACING * DIAGONAL_Y_RATIO + elevation,
        z: -(i - scrollPosition) * CARD_SPACING * DIAGONAL_Z_RATIO,
      });
    }

    return positions;
  }
}

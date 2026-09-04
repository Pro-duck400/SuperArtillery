// Handles projectile animation and trajectory tracking
import { Physics } from './physics';
import type { Renderer } from './renderer';
import type { Projectile } from './types/game';

export class ProjectileAnimator {
  private renderer: Renderer;
  private currentProjectile: Projectile | null = null;
  private trajectory: Array<{ x: number; y: number }> = [];
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private gravity = 600;
  private wind = 0;
  private canvasWidth: number;

  constructor(renderer: Renderer, canvasWidth: number) {
    this.renderer = renderer;
    this.canvasWidth = canvasWidth;
  }

  public configureScene(canvasWidth: number, _groundY: number, _launchY: number, gravity: number, wind: number): void {
    this.canvasWidth = canvasWidth;
    this.gravity = gravity;
    this.wind = wind;
  }

  /**
   * Start a new projectile animation
   */
  public fire(angle: number, velocity: number, startX: number, playerId: number): void {
    // Stop any existing animation
    this.stop();

    // For Player 1 (right side), flip the angle so they aim toward the left
    const adjustedAngle = playerId === 1 ? (180 - angle) : angle;

    // Calculate initial velocity components
    const { vx, vy } = Physics.calculateVelocityComponents(adjustedAngle, velocity);

    // Initialize projectile at castle position
    this.currentProjectile = {
      x: startX,
      y: this.renderer.getCastleTopY(playerId === 0 ? 0 : 1),
      vx,
      vy
    };

    // Reset trajectory
    this.trajectory = [{ x: this.currentProjectile.x, y: this.currentProjectile.y }];
    this.lastFrameTime = 0;

    // Start animation
    this.animationFrameId = requestAnimationFrame((timestamp) => this.animate(timestamp));
  }

  /**
   * Stop the current animation
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.currentProjectile = null;
    this.lastFrameTime = 0;
  }

  /**
   * Clear trajectory and render empty scene
   */
  public clear(): void {
    this.stop();
    this.trajectory = [];
    this.renderer.render(null);
  }

  /**
   * Animation loop
   */
  private animate(timestamp: number): void {
    if (!this.currentProjectile) return;

    const deltaTime = this.lastFrameTime === 0 ? 0 : (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    if (deltaTime > 0 && deltaTime < 0.1) {
      // Update projectile physics
      this.currentProjectile = Physics.updateProjectile(this.currentProjectile, deltaTime, this.gravity, this.wind);
      
      // Add to trajectory
      this.trajectory.push({ x: this.currentProjectile.x, y: this.currentProjectile.y });

      // Check if projectile hit terrain or went off screen
        if (this.currentProjectile.y >= this.renderer.getTerrainY(this.currentProjectile.x) ||
          this.currentProjectile.x < 0 || 
          this.currentProjectile.x > this.canvasWidth) {
        // Projectile finished - render final state and stop
        this.renderer.render(null, this.trajectory);
        this.currentProjectile = null;
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        return;
      }
    }

    // Render current state
    this.renderer.render(this.currentProjectile, this.trajectory);

    // Continue animation
    this.animationFrameId = requestAnimationFrame((timestamp) => this.animate(timestamp));
  }
}

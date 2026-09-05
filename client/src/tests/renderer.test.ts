import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from '../ts/renderer';
import type { BattlefieldConfig } from '../ts/types/messages';
import { createHistoricalTrajectories } from '../ts/trajectory';

function createContext(): CanvasRenderingContext2D & { strokeStyles: string[] } {
  const context = {
    strokeStyles: [] as string[],
    fillStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    setLineDash: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn()
  } as unknown as CanvasRenderingContext2D & { strokeStyles: string[] };

  Object.defineProperty(context, 'strokeStyle', {
    get: () => context.strokeStyles.at(-1) ?? '',
    set: (value: string) => context.strokeStyles.push(value)
  });
  return context;
}

const battlefield = {
  canvasWidth: 280,
  canvasHeight: 160,
  gravity: 100,
  wind: 0,
  groundY: 140,
  castleWidth: 10,
  castleHeight: 10,
  castles: [
    { playerId: 0, left_x: 20, base_y: 140 },
    { playerId: 1, left_x: 250, base_y: 140 }
  ],
  terrain: {
    version: 2,
    seed: 1,
    sampleWidth: 2,
    minY: 0,
    maxY: 140,
    leftY: 140,
    rightY: 140,
    hillCenter: 140,
    hillWidth: 50,
    hillHeight: 0
  }
} as BattlefieldConfig;

describe('Renderer trajectory styles', () => {
  let context: CanvasRenderingContext2D & { strokeStyles: string[] };

  beforeEach(() => {
    context = createContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  });

  it('draws historical and active trajectories with the same orange color', () => {
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.applyBattlefield(battlefield);
    context.strokeStyles.length = 0;

    renderer.render({
      projectile: null,
      historicalTrajectories: [{
        points: [{ x: 25, y: 130 }, { x: 30, y: 120 }],
        opacity: 1
      }],
      activeTrajectory: [{ x: 25, y: 130 }, { x: 35, y: 115 }]
    });

    expect(context.strokeStyles).toContain('rgba(255, 165, 0, 1)');
    expect(context.strokeStyles).not.toContain('#BEBEBE');
  });

  it('draws history without a separate historical color', () => {
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.applyBattlefield(battlefield);
    context.strokeStyles.length = 0;

    renderer.render({
      projectile: null,
      historicalTrajectories: [{
        points: [{ x: 25, y: 130 }, { x: 30, y: 120 }],
        opacity: 1
      }],
      activeTrajectory: []
    });

    expect(context.strokeStyles).toContain('rgba(255, 165, 0, 1)');
    expect(context.strokeStyles).not.toContain('#BEBEBE');
  });

  it('draws an active trajectory with the same orange color', () => {
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.applyBattlefield(battlefield);
    context.strokeStyles.length = 0;

    renderer.render({
      projectile: null,
      historicalTrajectories: [],
      activeTrajectory: [{ x: 25, y: 130 }, { x: 35, y: 115 }]
    });

    expect(context.strokeStyles).toContain('#FFA500');
    expect(context.strokeStyles).not.toContain('#BEBEBE');
  });

  it('uses the requested historical orange fade steps', () => {
    const history = createHistoricalTrajectories(
      battlefield,
      [
        { angle: 20, velocity: 100 },
        { angle: 30, velocity: 110 },
        { angle: 40, velocity: 120 },
        { angle: 50, velocity: 130 }
      ],
      0
    );

    expect(history.map((trajectory) => trajectory.opacity)).toEqual([0.4, 0.35, 0.3, 0.25]);
  });

  it('applies historical opacity directly to the orange stroke', () => {
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.applyBattlefield(battlefield);
    context.strokeStyles.length = 0;

    renderer.render({
      projectile: null,
      historicalTrajectories: [{
        points: [{ x: 25, y: 130 }, { x: 30, y: 120 }],
        opacity: 0.8
      }],
      activeTrajectory: []
    });

    expect(context.strokeStyles).toContain('rgba(255, 165, 0, 0.8)');
  });
});

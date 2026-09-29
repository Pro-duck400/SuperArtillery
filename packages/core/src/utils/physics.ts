function checkCastleCollision(
  x0: number, y0: number,
  vx: number, vy: number,
  gravity: number, wind: number,
  castleX: number, castleWidth: number, castleHeight: number,
  groundY: number
): number | null {
  const CASTLE_HIT_ZONE_RATIO = 0.95;
  const horizontalMargin = (castleWidth * (1 - CASTLE_HIT_ZONE_RATIO)) / 2;
  const verticalMargin = (castleHeight * (1 - CASTLE_HIT_ZONE_RATIO)) / 2;
  const left = castleX - castleWidth / 2 + horizontalMargin;
  const right = castleX + castleWidth / 2 - horizontalMargin;
  const top = groundY - castleHeight + verticalMargin;
  const bottom = groundY - verticalMargin;
  const intersections: number[] = [];

  if (vx !== 0) {
    const times = solveQuadratic(0.5 * wind, vx, x0 - left);
    for (const time of times) {
      if (time >= 0) {
        const y = y0 + vy * time + 0.5 * gravity * time * time;
        if (y >= top && y <= bottom) intersections.push(time);
      }
    }
  }

  if (vx !== 0) {
    const times = solveQuadratic(0.5 * wind, vx, x0 - right);
    for (const time of times) {
      if (time >= 0) {
        const y = y0 + vy * time + 0.5 * gravity * time * time;
        if (y >= top && y <= bottom) intersections.push(time);
      }
    }
  }

  const topTimes = solveQuadratic(0.5 * gravity, vy, y0 - top);
  for (const time of topTimes) {
    if (time >= 0) {
      const x = x0 + vx * time + 0.5 * wind * time * time;
      if (x >= left && x <= right) intersections.push(time);
    }
  }

  const bottomTimes = solveQuadratic(0.5 * gravity, vy, y0 - bottom);
  for (const time of bottomTimes) {
    if (time >= 0) {
      const x = x0 + vx * time + 0.5 * wind * time * time;
      if (x >= left && x <= right) intersections.push(time);
    }
  }

  return intersections.length > 0 ? Math.min(...intersections) : null;
}

function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-10) {
    if (Math.abs(b) < 1e-10) return [];
    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  if (discriminant === 0) return [-b / (2 * a)];

  const sqrtDiscriminant = Math.sqrt(discriminant);
  return [
    (-b + sqrtDiscriminant) / (2 * a),
    (-b - sqrtDiscriminant) / (2 * a)
  ];
}

export function calculateVelocityComponents(angle: number, velocity: number): { vx: number; vy: number } {
  const angleRad = (angle * Math.PI) / 180;
  return {
    vx: velocity * Math.cos(angleRad),
    vy: -velocity * Math.sin(angleRad)
  };
}

export interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function updateProjectile(
  projectile: ProjectileState,
  deltaTime: number,
  gravity: number,
  wind: number
): ProjectileState {
  return {
    x: projectile.x + projectile.vx * deltaTime + 0.5 * wind * deltaTime * deltaTime,
    y: projectile.y + projectile.vy * deltaTime,
    vx: projectile.vx + wind * deltaTime,
    vy: projectile.vy + gravity * deltaTime
  };
}

export function checkTerrainCollision(
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  gravity: number,
  wind: number,
  terrainY: (x: number) => number,
  canvasWidth: number,
  maxTime: number = 10
): number | null {
  const step = 0.01;
  for (let time = step; time <= maxTime; time += step) {
    const x = x0 + vx * time + 0.5 * wind * time * time;
    if (x < 0 || x > canvasWidth) return null;
    const y = y0 + vy * time + 0.5 * gravity * time * time;
    if (y >= terrainY(x)) return time;
  }
  return null;
}

export { checkCastleCollision };
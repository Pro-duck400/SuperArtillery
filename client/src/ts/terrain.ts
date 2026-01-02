// Terrain generation (placeholder for future sprints)

export class Terrain {
  // For MVP: just flat ground
  // Future: implement cosine curve generation
  
  public static generateFlat(width: number, height: number): number[] {
    const terrain = new Array<number>(Math.floor(width / 2));
    terrain.fill(height);
    return terrain;
  }
}

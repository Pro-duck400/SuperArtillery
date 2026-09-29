export class CastleRenderer {
  public draw(
    context: CanvasRenderingContext2D,
    glyph: string,
    leftX: number,
    baseY: number,
    castleHeight: number,
    isActive: boolean
  ): void {
    const fontSize = Math.max(10, Math.round(castleHeight * 1.7));
    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    context.fillStyle = isActive ? '#ffd700' : '#ffffff';
    context.fillText(glyph, leftX - 6, baseY + 2);
    context.restore();
  }
}
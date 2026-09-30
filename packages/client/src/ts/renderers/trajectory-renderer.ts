import type { HistoricalTrajectory, TrajectoryPoint } from '../trajectory';

const ACTIVE_TRAJECTORY_COLOR = '#555555';

export class TrajectoryRenderer {
  public drawActive(context: CanvasRenderingContext2D, trajectory: TrajectoryPoint[]): void {
    if (trajectory.length < 2) return;
    context.save();
    context.strokeStyle = ACTIVE_TRAJECTORY_COLOR;
    context.lineWidth = 1;
    context.setLineDash([2, 2]);
    context.beginPath();
    context.moveTo(trajectory[0]!.x, trajectory[0]!.y);
    for (let index = 1; index < trajectory.length; index++) {
      context.lineTo(trajectory[index]!.x, trajectory[index]!.y);
    }
    context.stroke();
    context.restore();
  }

  public drawHistorical(context: CanvasRenderingContext2D, trajectories: HistoricalTrajectory[]): void {
    for (const trajectory of trajectories) {
      if (trajectory.points.length < 2) continue;
      context.save();
      context.strokeStyle = `rgba(85, 85, 85, ${trajectory.opacity})`;
      context.lineWidth = 2;
      context.setLineDash([2, 3]);
      context.beginPath();
      context.moveTo(trajectory.points[0]!.x, trajectory.points[0]!.y);
      for (let index = 1; index < trajectory.points.length; index++) {
        context.lineTo(trajectory.points[index]!.x, trajectory.points[index]!.y);
      }
      context.stroke();
      context.restore();
    }
  }
}
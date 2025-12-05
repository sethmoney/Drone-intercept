export enum SimStatus {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  SUCCESS = 'INTERCEPTION SUCCESS',
  FAILURE = 'SOLDIER KIA',
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface MissionParams {
  missionName: string;
  enemyPos: Vector3;
  interceptorPos: Vector3;
  briefing: string;
}

export interface SimStats {
  targetDist: number;
  interceptorVel: number;
  closestApproach: number;
  elapsedTime: number;
}

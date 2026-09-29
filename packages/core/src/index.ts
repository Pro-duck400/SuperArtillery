export { CONTRACT_VERSION } from './contract/contract-version';
export { CORE_VERSION } from './core-version';
export * from './contract/messages';
export type { PlayerConnection } from './ports/player-connection';
export { SystemClock, type Clock } from './ports/clock';
export type { TimerHandle, TimerScheduler } from './ports/timer-scheduler';
export { sha256Hex } from './crypto/sha256';
export { encodeBase64 } from './crypto/base64';
export { randomBytes, randomUuid } from './crypto/random';
export { TERRAIN_VERSION, createBattlefield, getTerrainY } from './utils/battlefield';
export {
	calculateCastleHit,
	calculateCastleHitTime,
	calculateCastleHits,
	getDefaultShotDirection
} from './utils/shotResolver';
export {
	calculateVelocityComponents,
	checkCastleCollision,
	checkTerrainCollision,
	updateProjectile,
	type ProjectileState
} from './utils/physics';
export type {
	AcceptInvitationResponse,
	CreateGameResponse,
	CreateHotSeatResponse,
	ErrorResponse,
	GameStatus,
	GameStatusResponse,
	HealthResponse,
	Invitation,
	LobbySlot,
	LobbySlotStatus,
	PlayerSession,
	PrivateGame,
	RematchAnswer,
	SkipWaitingResponse,
	StatsResponse
} from './types/private-game';
export { GAME_CONFIG } from './services/gameConfig';
export { GAME_ERROR_CODES, GAME_ERROR_MESSAGES } from './services/gameErrors';
export { GameCleanupService, type GameCleanupOptions } from './services/gameCleanupService';
export { InMemoryGameRepository, type GameRepository } from './services/gameRepository';
export { InvitationService, type InvitationResult } from './services/invitationService';
export { GameRules, type FireTransition, type RematchTransition } from './services/gameRules';
export { TokenService } from './services/tokenService';
export { GameEngine, type EngineStats, type FireResponse, type GameEngineOptions, type RematchResponse } from './services/gameEngine';
export { GameMessageFactory, type GamePlayerState } from './services/gameMessageFactory';
export { GameError, type Result, failure, success } from './result';

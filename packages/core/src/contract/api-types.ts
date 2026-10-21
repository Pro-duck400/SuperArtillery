import type { components, paths } from './generated/openapi';

export type AcceptInvitationRequest = NonNullable<
  paths['/api/v1/invitations/accept']['post']['requestBody']
>['content']['application/json'];
export type AcceptInvitationResponse =
  paths['/api/v1/invitations/accept']['post']['responses'][200]['content']['application/json'];
export type CreateGameRequest = NonNullable<
  paths['/api/v1/games']['post']['requestBody']
>['content']['application/json'];
export type CreateGameResponse =
  paths['/api/v1/games']['post']['responses'][201]['content']['application/json'];
export type ErrorResponse = components['schemas']['ErrorResponse'];
export type FireRequest = NonNullable<
  paths['/api/v1/fire']['post']['requestBody']
>['content']['application/json'];
export type GameStatus = components['schemas']['GameStatus'];
export type GameStatusResponse =
  paths['/api/v1/games/{gameId}/status']['get']['responses'][200]['content']['application/json'];
export type HealthResponse =
  paths['/api/v1/health']['get']['responses'][200]['content']['application/json'];
export type LobbySlotResponse = components['schemas']['LobbySlot'];
export type LobbySlotStatus = LobbySlotResponse['status'];
export type RematchAnswer = components['schemas']['RematchAnswer'];
export type RematchPlayerStatus = components['schemas']['RematchPlayerStatus'];
export type RematchRequest = NonNullable<
  paths['/api/v1/games/{gameId}/rematch']['post']['requestBody']
>['content']['application/json'];
export type RematchResponse =
  paths['/api/v1/games/{gameId}/rematch']['post']['responses'][200]['content']['application/json'];
export type ShotDirection = components['schemas']['ShotDirection'];
export type SkipWaitingResponse =
  paths['/api/v1/games/{gameId}/skip-waiting']['post']['responses'][200]['content']['application/json'];
export type StatusResponse =
  paths['/api/v1/status']['get']['responses'][200]['content']['application/json'];
export type VersionResponse =
  paths['/api/v1/version']['get']['responses'][200]['content']['application/json'];

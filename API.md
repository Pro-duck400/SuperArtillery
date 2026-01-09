# API Documentation

## Communication Protocol

This document describes the REST API and WebSocket communication used by the MVP version of the game.

---

## REST API Endpoints (HTTP/HTTPS)

### Registration

**POST** `/api/v1/register`

**Payload:**
```json
name: string
```
**Response:**

- 200 Success 
```json
playerId: 0 | 1
```
- 409 Conflict
```json
details: string = "Player with name {name} already registered".
```
---

### Fire Action

**Payload**
```json
gameId: number;
playerId: number;
angle: number;
velocity: number;
```

**Response:**

- 200 Success 
```json
  type: "shot";
  playerId: number;
  angle: number;
  velocity: number;
```
IF (over 350 should blow up the player)
```json
  type: "game_over";
  winner: <playeId who won>;
```
- 403 Bad Request
```json
details: string = "The angle or velocity is invalid".
```

**POST** `/api/game/fire`

Sends the firing action for the current player's turn.

---

## WebSocket Messages (Real-time Game Events)

WebSockets are used to synchronise game state between both players.

---

### Server → Client

#### Game Start

Sent when the second player connects and the game begins.

```json
{
  "type": "game_start",
  "playerId": 0,
  "turn": 0
}
```

#### Shots Fired

Broadcast to both players after a successful fire action.

```json
{
  "type": "shot",
  "playerId": 0,
  "angle": 45,
  "velocity": 200
}
```

#### Turn Change

Sent when a shot misses and the turn switches to the other player.

```json
{
  type: "turn_change",
  playerId_turn: 0 | 1
}
```

#### Game Ends

Sent when a player wins the game.

```json
{
  type: "game_over",
  winner: 0 | 1
}
```

---

### Client → Server

#### Fire action

Sent when the current player fires a projectile.

```json
{
  type: "fire",
  angle: number,
  velocity: number
}
```
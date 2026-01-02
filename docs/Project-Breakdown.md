# Project Breakdown
1. Game Rendering (Front‑End)
  
  -	HTML5 Canvas
  -	Simple physics (angle, velocity, gravity)
  -	Terrain generation (random or fixed)
  -	Explosion effects

2. Game Logic

  -	Turn‑based:
  -	Player A fires → server relays → Player B updates
  -	Shared state:
    -	Positions
    -	Wind
    -	Health

3. Networking
- WebSocket connection to server
-	Messages:
	  - join
    - start
    - player_action
    - state_update
    - game_over

4. Server
-	Node.js + ws
-	Match two players
-	Relay messages
-	Optionally validate moves

5. Deployment
-	Static front‑end on GitHub Pages or Netlify
-	Node server on Render or Railway
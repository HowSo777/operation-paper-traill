# Multiplayer Wireframe FPS

A real-time multiplayer 3D wireframe first-person shooter built with Next.js, React, Three.js, and Socket.io.

## Features
- **3D Graphics & Physics:** Three.js wireframe renderer with spatial collision and particle FX.
- **Real-Time Multiplayer:** Socket.io synchronization for player positions, pitch/yaw, weapon shooting, and hit registration.
- **Two Game Modes:**
  - **Ironworks (5v5 Deathmatch):** Team-based PvP (Red vs. Blue) with round timers, respawn systems, and live leaderboards.
  - **Rescue:** Cooperative compound infiltration with local bot AI.
- **Unified Single-Port Architecture:** Both Next.js and Socket.io run on a single port for seamless cloud hosting (Render, Railway, Fly.io, etc.).

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install --strict-ssl=false

# 2. Run the unified development server
npm run dev:unified

# 3. Open in browser
http://localhost:3000
```

## Running Online with a Public Tunnel
```bash
npx localtunnel --port 3000
```

## Deploying to Cloud (Render / Railway / VPS)

### Render (Recommended for Free 24/7 Hosting)
1. Push this repository to GitHub.
2. Log in to [Render.com](https://render.com) and click **New + > Web Service**.
3. Select your repository.
4. Configure:
   - **Environment:** Node
   - **Build Command:** `npm install --strict-ssl=false && npm run build`
   - **Start Command:** `npm run start:unified`
5. Click **Deploy**. Your game will be live at `https://your-service.onrender.com`.

### Railway
1. Click **New Project > Deploy from GitHub repo**.
2. Set Start Command to `npm run start:unified`.
3. Railway will automatically assign a domain with full WebSocket support.

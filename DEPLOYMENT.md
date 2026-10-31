# PAPER TRAIL // 24/7 Cloud Hosting & PWA Installation Guide

This guide explains how to host the game permanently online 24/7 on **Render** (free tier with full WebSocket support) or **Railway**, and how to install it as a standalone app on your PC, Mac, Android, and iOS devices like Krunker.io.

---

## ⚡ Why Render or Railway (Instead of Vercel)?

- **Vercel** is designed for serverless functions (requests terminate after a few seconds). It **cannot** maintain persistent 64-tick WebSocket rooms for multiplayer game servers (Socket.io).
- **Render** and **Railway** run persistent, dedicated Node.js containers that stay online 24/7 with full bi-directional WebSocket support, HTTPS, and persistent database storage.

---

## Option 1: Deploy to Render (Recommended - Free Web Service)

Render provides a free Web Service tier with native Node.js and persistent WebSockets.

### Step 1: Push code to your GitHub
1. Open terminal in the project directory:
   ```bash
   git add .
   git commit -m "feat: Ready for Render and PWA app"
   ```
2. Create a new GitHub repository at [github.com/new](https://github.com/new).
3. Push your repository:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) (sign up for free).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Render will auto-detect settings, or enter these:
   - **Name:** `paper-trail-fps`
   - **Environment:** `Node`
   - **Region:** Any (e.g. `Oregon (US West)` or `Frankfurt (EU)`)
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan Type:** `Free`
5. Click **Create Web Service**.
6. Render will build and deploy the game in 2-3 minutes. You will receive a permanent public URL like:
   `https://paper-trail-fps.onrender.com`

---

## Option 2: Deploy to Railway

Railway is another popular platform with instant container deployments and high-tick WebSocket performance.

1. Go to [railway.app](https://railway.app/).
2. Click **Start a New Project** -> **Deploy from GitHub repo**.
3. Select your repository.
4. Railway will automatically use the included `Dockerfile` or Node buildpack.
5. In project settings, click **Generate Domain**. You will get a permanent URL like `https://paper-trail.up.railway.app`.

---

## 📱 How to Install and Play as a Native App (PWA)

The game includes a **Progressive Web App (PWA)** manifest with landscape orientation lock and standalone app mode:

### On PC / Mac (Chrome, Edge, Brave)
1. Open the game's live URL in Google Chrome or Microsoft Edge.
2. In the browser address bar, click the **Install App** icon (monitor with down arrow) or click the **3 dots menu** -> **Save and Share** -> **Install PAPER TRAIL**.
3. A desktop shortcut and Start Menu item will be created.
4. When opened, it launches in its own dedicated, borderless window with full hardware acceleration, dedicated taskbar icon, and pointer-lock gaming controls (just like Krunker's official desktop client).

### On Android
1. Open the live URL in Google Chrome.
2. Tap the **3 dots menu** -> tap **Add to Home screen** or **Install app**.
3. The game icon will appear on your home screen and app drawer. Launching it opens directly in full-screen landscape mode without any browser URL bars.

### On iPhone / iPad (iOS Safari)
1. Open the live URL in Safari.
2. Tap the **Share** button (box with upward arrow at the bottom).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The custom game reticle icon will be added to your home screen. Launching it runs fullscreen without Safari tabs or address bars.

---

## 🛠 Local Unified Server Commands

- **Build:** `npm run build`
- **Start Unified Server (Next.js + Socket.io):** `npm start`
- **Typecheck:** `npm run typecheck`

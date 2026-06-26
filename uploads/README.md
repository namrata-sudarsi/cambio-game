# Cambio Card Game 🃏

A browser-based version of the popular Cambio card game. Play against an AI opponent — try to get the lowest score!

## Play Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Deploy to Vercel (free)

1. Push this project to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/cambio-card-game.git
   git branch -M main
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) and sign in with GitHub

3. Click **"Add New Project"** → Import your `cambio-card-game` repo

4. Vercel auto-detects Vite — just click **Deploy**

5. Done! You'll get a live URL like `cambio-card-game.vercel.app`

Every future `git push` will auto-redeploy.

## Game Rules

- 4 face-down cards in a 2×2 grid — peek at your bottom 2
- Draw from the deck or discard pile each turn
- Swap cards to lower your score, or discard to use abilities
- **Stick** a card if it matches the top of the discard pile to remove it
- Call **Cambio** when you think you have the lowest total!

**Points:** A=1 · 2–10 face value · J/Q/K=10 · Red K=−1 · Joker=0

**Abilities:** 7/8 peek own · 9/10 peek opponent · J/Q blind swap · Black K look & swap

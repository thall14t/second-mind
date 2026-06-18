# Deploying the AI Server to Render (Free Tier for Trialing)

This sets up the backend for cloud use so the app works without a local PC server.

## Prerequisites
- GitHub repo with the Antinet code pushed.
- xAI API key.

## One-Time Setup on Render

1. Go to [render.com](https://dashboard.render.com) and sign up (free).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account and select the Antinet repo.
4. Render will detect the `render.yaml` file.
5. Review and click **Apply**.
6. In the service settings:
   - Go to **Environment** tab.
   - Add:
     - `XAI_API_KEY` = your actual Grok key (secret)
     - (Optional) Override `AI_MODEL` if needed.
7. Deploy. Wait for the green "Live" status.
8. Copy your service URL (e.g. `https://second-mind-ai.onrender.com`).

## In the Mobile App

1. Open the app.
2. Go to **Settings** → **Developer Settings**.
3. In "AI Assist Server", paste your Render URL (no trailing slash).
4. Tap **Save AI Server URL**.

The app will now use the cloud backend for AI features.

## Free Plan Notes for ~10 Trial Users
- Service sleeps after 15 min of no traffic → first request may take 20-40s (cold start).
- For better experience during trials, use a free uptime monitor (e.g. UptimeRobot) to ping `https://your-url.onrender.com/health` every 5-10 minutes.
- Should handle light usage from 10 users fine.
- Monitor usage in Render dashboard.

## Updating
Push new commits to GitHub → Render auto-deploys.

## Important
- Never commit your XAI_API_KEY.
- For production/App Store later, upgrade to a paid plan to avoid cold starts and add custom domain.

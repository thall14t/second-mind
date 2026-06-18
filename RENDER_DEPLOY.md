# Deploying the AI Server to Render (Free Tier for Trialing)

This sets up the backend for cloud use so the app works without a local PC server.

## Prerequisites
- GitHub repo with the Antinet code pushed.
- xAI API key.

## One-Time Setup on Render

1. Go to [render.com](https://dashboard.render.com) and sign up (free).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account and select the "second-mind" repo.
4. Make sure it detects the `render.yaml` (you should see a green check and your last commit message).
5. Scroll all the way to the **bottom** of the page.
6. Look for a big button that says **Apply**, **Create**, **Deploy**, or **Confirm**.
   - If the name "second-mind-ai" is already in use (this is common with Blueprints):
     - Do NOT try to create another service with that name.
     - Click the left sidebar and go to "Services".
     - You should see "second-mind-ai" listed there (the Blueprint already created it).
     - Click on "second-mind-ai" to open its dashboard.
6. In the service settings:
   - Go to **Environment** tab.
   - Add the variable (use "Add Environment Variable", not Secret Files):
     - Key: `XAI_API_KEY`
     - Value: paste your full Grok API key
     - If you don't see a "Secret" checkbox right away:
       - Save it anyway (the eye icon will let you hide it from view).
       - Then click the edit icon (pencil or three dots) next to the `XAI_API_KEY` in the list.
       - In the edit form, a "Secret" checkbox should now appear — check it.
     - Save.
     - (Optional) Make sure `AI_MODEL` is set to `grok-4-1-fast`.
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

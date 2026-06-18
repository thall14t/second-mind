# Second Mind AI Assist Server

This local server keeps your AI API key out of the Expo app. It defaults to Grok through the xAI API, but can still be pointed at OpenAI-compatible providers.

## Setup

1. Copy `server/.env.example` to `server/.env`.
2. Put your Grok/xAI API key in `XAI_API_KEY`.
3. From the project root, run:

```powershell
npm run ai-server
```

The server listens on port `3001` by default.

It currently powers:

- `POST /api/suggest-card-filing` for AI category/card suggestions.
- `POST /api/ask-cards` for answering questions from saved cards.
- `POST /api/classify-capture` for routing rough captures to card or todo paths.
- `POST /api/enrich-card-capture` for structuring card drafts from captures.
- `POST /api/generate-todos` for generating nestable todos from captures.

Example `server/.env`:

```text
AI_PROVIDER=xai
AI_BASE_URL=https://api.x.ai/v1
XAI_API_KEY=your_grok_api_key_here
AI_MODEL=grok-4-1-fast
PORT=3001
```

If your xAI console shows a different enabled model, replace `AI_MODEL` with that model name.

## Deploy to Render (Free Tier for Trialing)

For cloud deployment (required for App Store trialing), deploy this server to [Render](https://render.com).

### Steps:
1. Push your code to GitHub (the `Antinet` folder as root).
2. Go to Render Dashboard → New → Blueprint.
3. Connect your GitHub repo.
4. Render will detect `render.yaml` and create the service.
5. In the service settings:
   - Set **XAI_API_KEY** as an Environment Variable (do not commit it).
   - (Optional) Set other vars like AI_MODEL.
6. Deploy. Your URL will be something like `https://second-mind-ai.onrender.com`.
7. In the mobile app Settings, set the AI Server URL to your Render URL (without trailing slash).

**Important for Free Plan:**
- The service sleeps after 15 minutes of inactivity (cold start ~20-40s on first request).
- Fine for trialing with ~10 users.
- To reduce cold starts, you can ping the /health endpoint periodically (e.g. with UptimeRobot free).

It currently powers:
- `POST /api/suggest-card-filing`
- `POST /api/ask-cards`
- `POST /api/structure-capture` (legacy inbox fallback)
- `POST /api/classify-capture`
- `POST /api/enrich-card-capture`
- `POST /api/generate-todos`

## Expo Go / Local Testing

If you are testing on a physical phone, `localhost` usually points to the phone, not your computer.

Use your computer's local network IP in the app's Settings screen, for example:

```text
http://192.168.1.10:3001
```

Then tap `Save AI Server URL`.

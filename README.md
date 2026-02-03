# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Deploy on Vercel (recommended)

This repo includes a Vercel Serverless Function (`/api/benchmark`) that calls your LiteLLM proxy.

**1) Set env vars in Vercel**

- `LITELLM_BASE_URL` = your public LiteLLM proxy base URL (example: `https://YOUR_LITELLM_DOMAIN`)
- `LITELLM_API_KEY` = optional (only if your LiteLLM proxy requires a key)

**2) Deploy**

Connect the GitHub repo to Vercel (or run `vercel --prod`).

**3) Verify**

Open the app and click **Run Benchmark**. The app calls:

- Frontend → `POST /api/benchmark`
- Vercel Function → `LITELLM_BASE_URL/v1/chat/completions`

### LiteLLM proxy

LiteLLM must run separately (VPS, Railway, EC2, etc.). An example `litellm-config.yaml` is included.

You will typically set the provider key (e.g., `OPENROUTER_API_KEY`) on the LiteLLM host, not in Vercel.

### Deploy via Lovable

You can still publish from Lovable, but Vercel is recommended when you need a real `/api/*` backend.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

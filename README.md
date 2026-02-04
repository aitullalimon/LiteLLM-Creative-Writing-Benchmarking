# Welcome to Creative Writing Benchmark

## Project info

**URL**: https://litellm-creative-writing-benchmarking-xclo.onrender.com

##  Creative Writing Benchmark

LLM Evaluation Platform for Creative Writing Quality
A research-grade web application for benchmarking large language models (LLMs) on creative writing tasks, using multi-metric evaluation and LLM-as-a-judge scoring.


##  Overview
### Creative Writing Benchmark allows users to:
Compare multiple LLMs on the same creative prompt

Automatically evaluate outputs using a judge model

### Score models on:
    . Theme Coherence
    . Creativity
    . Fluency
    . Engagement

Visualize results through charts and leaderboards

Run in Demo Mode (no API credits required) or Live Mode (OpenRouter / LiteLLM)

### This project is suitable for:
    . Research demos
    . Model comparison studies
    . Product evaluation
    . Client presentations


## Key Features
    . Multi-model benchmarking (OpenAI, OpenRouter, Anthropic, Moonshot, etc.)
    . LLM-as-a-Judge evaluation pipeline
    . Multi-metric scoring (0–40 total score)
    . Visual analytics (charts & leaderboard)
    . Demo / Preview mode (no API billing required)
    . Deployed on Render (production-ready)

## Screenshots
Add screenshots to the /screenshots folder and reference them below.
Benchmark Configuration
Results & Charts
Leaderboard

## Architecture

    Frontend (React + Vite)
            |
            | POST /api/benchmark
            ↓
    Node.js Server (Express)
            |
            | OpenAI-compatible API
            ↓
    LiteLLM / OpenRouter

## Environment Variables

    Configure the following in Render → Environment or a local .env file.
    Required (Live Mode)
    LITELLM_BASE_URL=https://openrouter.ai/api/v1
    LITELLM_API_KEY=sk-or-xxxxxxxxxxxxxxxx
### Optional (Demo Mode)
    MOCK_MODE=true

When MOCK_MODE=true, the app renders charts and scores without calling external APIs — perfect for demos when credits are unavailable.

## Running Locally
    npm install
    npm run build
    npm start
### App will run on:
http://localhost:10000

## Production Deployment
    Hosted on Render
    Auto-deploys on main branch push
    Uses Node.js + static Vite build
### To redeploy:
    git push origin main

## Demo vs Live Mode
Mode	Description
Demo Mode	Visual demo with mock scores (no billing)
Live Mode	Real API calls using OpenRouter / LiteLLM
Switch modes via environment variables — no code changes required.

## Evaluation Metrics
#### Each model output is scored on:
    Metric	Range
    Theme Coherence	0–10
    Creativity	0–10
    Fluency	0–10
    Engagement	0–10
    Total Score	0–40

## API Endpoint
### POST /api/benchmark
### Request
{
  "prompt": "Write a short story about a lighthouse keeper...",
  "models": ["openai/gpt-4o-mini"],
  "judgeModel": "openai/gpt-4o-mini"
}

### Response
{
  "results": [
    {
      "modelName": "gpt-4o-mini",
      "provider": "openai",
      "themeCoherence": 8,
      "creativity": 7,
      "fluency": 9,
      "engagement": 8,
      "totalScore": 32
    }
  ]
}

## Notes for Client
If results do not appear:
Check API credits
Verify LITELLM_API_KEY
Use Demo Mode for preview
Model availability depends on OpenRouter account permissions

## Author
Creative Writing Benchmark
Developed by **Aitulla Labib Limon**
Research & AI Engineering

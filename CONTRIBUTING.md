# Contributing

Thanks for taking a look at Routine Manager.

## Development

1. Use Node.js `20.9.0` or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add your own Notion integration values.
4. Run the app with `npm run dev`.

Before opening a pull request, run:

```bash
npm run lint
npm run build
```

## Pull Requests

- Keep pull requests focused on one fix or feature.
- Include screenshots or a short screen recording for UI changes.
- Update `README.md` when setup, environment variables, or user-facing behavior changes.
- Do not include personal Notion data, tokens, `.env.local`, generated build output, or local tool settings.

For larger changes, please open an issue first to discuss the shape of the work.

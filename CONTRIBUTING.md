# Development

1. Install Node.js 24 and run npm ci.
2. Run npm test and npm run lint.
3. Run npm run build. Set SPICETIFY_SKIP=true to build without a local Spotify installation.
4. Verify changed user flows inside Spotify. Include the track, renderer and view mode when reporting failures; unit tests do not replace runtime and visual checks.
5. Update ProjectVersion in project/config.ts and the matching versions in package.json / package-lock.json when preparing a release. Keep ApiCompatibilityVersion independent.
6. Describe changes in CHANGELOG.md.

Generated bundles, dependencies, caches and personal settings are excluded from Git. Never commit Spotify access tokens or account data.

CI runs tests, lint and a production build. It does not publish releases automatically.

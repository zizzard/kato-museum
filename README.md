# museum.goodvibes.gg

A trimmed-down copy of the [skinsales.gg Kato museum](https://skinsales.gg/museum):
no site header, owners, or sale/listing info.

The skinsales API doesn't allow requests from this domain, so `npm run snapshot`
downloads the museum into `public/data/` and the site reads that. GitHub Actions
re-runs the snapshot and redeploys daily (and on every push to `main`).

```bash
npm install
npm run snapshot
npm run dev
```

DNS: `museum` CNAME -> `zizzard.github.io`.

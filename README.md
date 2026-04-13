# swagger_api

A small [Express](https://expressjs.com/) service that exposes a sample **users** REST API and serves interactive **[Swagger UI](https://github.com/scottie1984/swagger-ui-express)** from an OpenAPI 3 spec in YAML.

## Features

- **OpenAPI 3** document at `api.yaml` describing the `User` schema and `/users` operations
- **Swagger UI** at `/api-docs` to try requests against the same server
- **Seed data**: ten demo users with nested `address`, `skills`, `bio`, and profile `image` URLs
- **Optional Unsplash**: if `UNSPLASH_ACCESS_KEY` is set, startup fetches portrait photos from the [Unsplash API](https://unsplash.com/documentation); otherwise curated Unsplash CDN URLs are used (no key required)

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

The server listens on **port 3000** by default, or the port given by the `PORT` environment variable.

| URL | Description |
| --- | --- |
| `http://localhost:3000/` | Redirects to Swagger UI |
| `http://localhost:3000/api-docs` | Swagger UI (loads `api.yaml`) |
| `http://localhost:3000/users` | `GET` — list all users |

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port (default `3000`) |
| `UNSPLASH_ACCESS_KEY` | No | Unsplash **Access Key**; when set, random portrait images are loaded on startup and `imageCredit` may be set per user |

### Example (PowerShell)

```powershell
$env:UNSPLASH_ACCESS_KEY = "your_access_key"
$env:PORT = "4000"
npm start
```

## API overview

- **`GET /users`** — Returns JSON array of users (`200`), or `404` if the list is empty (not expected under normal startup).
- **`POST /users`** — Creates a user from JSON body. **`name` is required**; other fields (`age`, `isActive`, `skills`, `address`, `image`, `bio`, `imageCredit`) are optional. Responds with `201` and the created resource including an assigned `id`.

Full request/response shapes and examples live in **`api.yaml`**.

## Project layout

| File | Role |
| --- | --- |
| `index.js` | Express app, routes, seed user build, Unsplash integration |
| `api.yaml` | OpenAPI 3 specification for Swagger UI |
| `package.json` | Dependencies and `npm start` script |

## Dependencies

- `express` — HTTP server and routing
- `swagger-ui-express` — Host Swagger UI
- `yamljs` — Load `api.yaml` at runtime

## License

ISC (see `package.json`).

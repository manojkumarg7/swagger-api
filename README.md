# swagger_api

A small [Express](https://expressjs.com/) service that exposes a sample **users** REST API and serves interactive **[Swagger UI](https://github.com/scottie1984/swagger-ui-express)** from an OpenAPI 3 spec in YAML.

## Features

- **OpenAPI 3** document at `api.yaml` describing the `User` schema and `/users` plus `/users/{id}` operations
- **Swagger UI** at `/api-docs` to try requests against the same server
- **Seed data**: ten demo users with nested `address`, `skills`, `bio`, and profile `image` URLs
- **Optional MongoDB**: if `MONGODB_URI` is set, users are stored with [Mongoose](https://mongoosejs.com/) and the demo list is **inserted only when the collection is empty**; if it is unset, the app keeps the same API but holds users **in memory** (lost when the process exits)
- **CORS**: [cors](https://github.com/expressjs/cors) is enabled so browsers can call the API from another origin (e.g. Live Server on `http://127.0.0.1:5500`). By default **all origins** are allowed; set **`CORS_ORIGINS`** (comma-separated) on Render or locally to lock it down.
- **Optional Unsplash**: if `UNSPLASH_ACCESS_KEY` is set, startup fetches portrait photos from the [Unsplash API](https://unsplash.com/documentation); otherwise curated Unsplash CDN URLs are used (no key required)

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)

## Setup

```bash
npm install
```

Copy **`.env.example`** to **`.env`**, set **`MONGODB_URI`** for Atlas (or another MongoDB), and **do not commit** `.env` (it is listed in **`.gitignore`**).

For [MongoDB Atlas](https://www.mongodb.com/docs/atlas/), allow your client IP under **Network Access** (for quick local tests, many teams use `0.0.0.0/0`; tighten this for production). Put your **database user password only in `.env`**, not in source code or chat logs—if a password was exposed, **rotate it** in Atlas and update `.env`.

Use a URI that includes a **database name** before the query string, for example:

`...mongodb.net/mySwaggerApiDb?retryWrites=true&w=majority`

## Run

```bash
npm start
```

The server listens on **port 3000** by default, or the port given by the `PORT` environment variable.

| URL                                | Description                                                             |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `http://localhost:3000/`           | Redirects to Swagger UI                                                 |
| `http://localhost:3000/api-docs`   | Swagger UI (loads `api.yaml`)                                           |
| `http://localhost:3000/users`      | `GET` — list users; `POST` — create user                                |
| `http://localhost:3000/users/{id}` | `PUT` — update user; `DELETE` — remove user (`id` is numeric, e.g. `1`) |

## Environment variables

| Variable              | Required | Description                                                                                                           |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`         | No       | MongoDB connection string (e.g. Atlas `mongodb+srv://...`). When unset, users stay in memory only.                    |
| `CORS_ORIGINS`        | No       | Comma-separated allowed browser origins. When unset, **any** origin is allowed (handy for local frontends).           |
| `PORT`                | No       | HTTP port (default `3000`)                                                                                            |
| `UNSPLASH_ACCESS_KEY` | No       | Unsplash **Access Key**; when set, random portrait images are loaded on startup and `imageCredit` may be set per user |

### Example (PowerShell)

```powershell
$env:MONGODB_URI = "mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/mySwaggerApiDb?retryWrites=true&w=majority"
$env:UNSPLASH_ACCESS_KEY = "your_access_key"
$env:PORT = "4000"
npm start
```

## API overview

- **`GET /users`** — Returns a JSON array of users (`200`), or `404` if the list is empty (not expected under normal startup).
- **`POST /users`** — Creates a user from a JSON body. **`name` is required**; other fields (`age`, `isActive`, `skills`, `address`, `image`, `bio`, `imageCredit`) are optional. Responds with **`201`** and the new resource. New **`id`** values are **`max(existing id) + 1`**, so they stay unique after **`DELETE`** calls.
- **`PUT /users/:id`** — Updates the user with that **`id`**. **`name` is required** in the body; the **`id`** in the URL is the one stored (any **`id`** in the body is ignored). **`200`** on success, **`400`** for an invalid id or missing name, **`404`** if the user does not exist.
- **`DELETE /users/:id`** — Removes the user with that **`id`**. **`204`** with no body on success, **`400`** for an invalid id, **`404`** if the user does not exist.

Full request/response shapes and examples live in **`api.yaml`** (try **`/users/{id}`** in Swagger UI).

## Project layout

| File           | Role                                                        |
| -------------- | ----------------------------------------------------------- |
| `index.js`     | Express app, routes, optional MongoDB, seed users, Unsplash |
| `api.yaml`     | OpenAPI 3 specification for Swagger UI                      |
| `package.json` | Dependencies and `npm start` script                         |
| `.env.example` | Sample environment variables (copy to `.env`)               |

## Dependencies

- `express` — HTTP server and routing
- `cors` — Cross-Origin Resource Sharing for browser clients (e.g. local HTML on port 5500 calling Render)
- `mongoose` — MongoDB object modeling (used when `MONGODB_URI` is set)
- `dotenv` — Load `.env` for local configuration
- `swagger-ui-express` — Host Swagger UI
- `yamljs` — Load `api.yaml` at runtime

## License

ISC (see `package.json`).

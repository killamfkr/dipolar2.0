# Unraid Docker templates

Use these templates to run Dipolar (Streamio IPTV) as two containers on Unraid instead of using Docker Compose.

## Prerequisites

Images are published to **GitHub Container Registry** (ghcr.io). Unraid will pull them when you add the containers—no need to build locally.

If you prefer to build from source (e.g. after changing the code), clone the repo and run `docker compose build`, then change the template Repository back to `dipolar-server:latest` / `dipolar-app:latest` for local images.

Alternatively, use the [Docker Compose plugin](https://forums.unraid.net/topic/114047-docker-compose-manager/) and run `docker compose up -d` from the repo—no templates needed.

## Adding the templates

1. Copy the XML files to Unraid’s user templates folder:
   - `dipolar-server.xml` → `/boot/config/plugins/dockerMan/templates-user/`
   - `dipolar-app.xml` → `/boot/config/plugins/dockerMan/templates-user/`
2. Or add this repo as a **Template Repositories** source in Community Applications (if you publish the repo with the `unraid/` folder and CA supports it).

## Installing the containers

No custom network or Network dropdown needed. The server uses **Host** network (API on the Unraid host:3333); the app uses **Bridge** and reaches the host via `host.docker.internal`.

1. **Docker** → **Add Container** → choose **Dipolar Server**. Leave **Network type** as **Host** (the template sets this). Create the container.
2. **Add Container** again → **Dipolar App**. Leave **Extra Parameters** as `--add-host=host.docker.internal:host-gateway` (the template sets this). Set the host port (e.g. 3000). Create.
3. Open **http://UNRAID_IP:3000** in your browser for the app.

## Notes

- **Dipolar Server** uses **Host** network, so the API listens on the Unraid host on port **3333** (no port mapping).
- **Dipolar App** uses **Bridge** and talks to the API at `host.docker.internal:3333` (Extra Parameters add that hostname).
- You don’t need to change any Network setting in the Docker UI; the templates handle it.
- To update: **Docker** → select container → **Recreate** (or pull the image first).
- If pull fails with “access denied”, the GitHub package may be private: go to the repo → **Packages** (right side) → open **dipolar-server** or **dipolar-app** → **Package settings** → change **Visibility** to **Public**.

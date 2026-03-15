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

## Updating the templates

When the repo’s `unraid/` folder changes (e.g. new image URLs or settings), copy the updated XML files over the existing ones in `/boot/config/plugins/dockerMan/templates-user/`. Existing containers keep their settings; new containers you add will use the updated template.

## Installing the containers

Images pull from **ghcr.io** (no local build). No custom network or Network dropdown needed.

1. **Docker** → **Add Container** → **Template** → **Dipolar Server**. Leave **Network type** as **Host**. Create.
2. **Add Container** again → **Template** → **Dipolar App**. Leave **Extra Parameters** as `--add-host=host.docker.internal:host-gateway`. Set **Host port** to **3000** (or another free port). Create.
3. Open **http://UNRAID_IP:3000** in your browser (use your server’s IP and the port you chose).

## Notes

- **Dipolar Server** uses **Host** network, so the API listens on the Unraid host on port **3333** (no port mapping).
- **Dipolar App** uses **Bridge** and talks to the API at `host.docker.internal:3333` (Extra Parameters add that hostname).
- You don’t need to change any Network setting in the Docker UI; the templates handle it.
- To update: **Docker** → select container → **Recreate** (or pull the image first).
- If pull fails with “access denied”, the GitHub package may be private: go to the repo → **Packages** (right side) → open **dipolar-server** or **dipolar-app** → **Package settings** → change **Visibility** to **Public**.

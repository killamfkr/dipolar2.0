# Unraid Docker templates

Use these templates to run Dipolar (Streamio IPTV) as two containers on Unraid instead of using Docker Compose.

## Prerequisites

Build the images once from the repo (e.g. on Unraid or any machine that can push to your server):

```bash
cd /mnt/user/appdata/dipolar2.0   # or wherever you cloned
docker compose build
```

Or use the [Docker Compose plugin](https://forums.unraid.net/topic/114047-docker-compose-manager/) and run `docker compose up -d` from the repo—no templates needed.

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
- To update: pull or rebuild the images, then recreate the containers from the same templates.

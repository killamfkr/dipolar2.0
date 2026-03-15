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

1. **Docker** → **Add Container**.
2. Under **Template**, choose **Dipolar Server**. Leave the name as `dipolar-server` (the app container links to this name). Create the container.
3. **Add Container** again, choose **Dipolar App**. Leave **Extra Parameters** as `--link dipolar-server:server` so the app can reach the API. Set the host port (e.g. 3000) if you want. Create the container.
4. Open **http://UNRAID_IP:3000** in your browser for the app.

## Notes

- The **Dipolar Server** container has no published port; only the app talks to it.
- The **Dipolar App** container must be able to resolve hostname `server` to the API container; the template uses `--link dipolar-server:server` for that.
- To update: pull or rebuild the images, then recreate the containers from the same templates.

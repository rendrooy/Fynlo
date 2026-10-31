# Deploying Fynlo to a VPS

One Ubuntu server runs the web app and API behind Caddy, which handles HTTPS. The database stays on Supabase.

In these steps, replace `IP_VPS` with your server's IP address, and `deploy` with your server's app user if yours has another name. The site address is that IP followed by `.sslip.io`, such as `203.0.113.10.sslip.io`. No domain purchase is needed.

Never put a password, token, or `.env` file in the repository.

## 1. Secure the server

Sign in from your laptop:

```powershell
ssh -i "$HOME\.ssh\fynlo_vps" root@IP_VPS
```

If your provider disables `root`, sign in with the username it gives you, such as `ubuntu`, then switch to root. The next commands need it:

```bash
sudo -i
SSH_KEYS=/home/ubuntu/.ssh/authorized_keys
```

Change `ubuntu` to your username. If you signed in as `root`, run only `SSH_KEYS=/root/.ssh/authorized_keys`.

On the server, update it and create a user for the app. The user gets your SSH key:

```bash
apt update && apt upgrade -y
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
mkdir -p /home/deploy/.ssh
cp "$SSH_KEYS" /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Open the firewall for SSH and the website only:

```bash
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw enable
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
```

Keep this session open. In a new PowerShell window, confirm that the new user works:

```powershell
ssh -i "$HOME\.ssh\fynlo_vps" deploy@IP_VPS
```

Only after that works, turn off password and root sign-in. A mistake here can lock you out, so do it from the session you kept open:

```bash
printf 'PasswordAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/99-fynlo.conf
sshd -t && systemctl reload ssh
```

From here on, work as `deploy`.

## 2. Add swap memory

Swap keeps a small server from running out of memory during a build:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Install the tools

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pnpm@9.12.1 pm2

sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 4. Get the code

If the GitHub repository is private, create a read-only deploy key on the server and add it under the repository's **Settings → Deploy keys**:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_fynlo
cat ~/.ssh/github_fynlo.pub
printf 'Host github.com\n  IdentityFile ~/.ssh/github_fynlo\n' >> ~/.ssh/config
git clone git@github.com:rendrooy/Fynlo.git ~/fynlo
```

For a public repository, use `git clone https://github.com/rendrooy/Fynlo.git ~/fynlo`.

## 5. Configure

Create `~/fynlo/apps/server/.env` with `nano`, using these values:

```bash
DATABASE_URL=your Supabase Session pooler connection string
DB_SCHEMA=fynlo
JWT_SECRET=a new secret, generated below
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://IP_VPS.sslip.io
DATABASE_CA_PATH=/home/deploy/supabase-ca.crt
```

Generate the secret on the server. Use a new one rather than the one on your laptop:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Download the certificate from **Supabase → Project Settings → Database → SSL Configuration**, then copy it from your laptop:

```powershell
scp -i "$HOME\.ssh\fynlo_vps" "$HOME\Downloads\prod-ca-2021.crt" deploy@IP_VPS:/home/deploy/supabase-ca.crt
```

The file name can differ. If you skip this step, remove `DATABASE_CA_PATH`. The connection stays encrypted, but the server's identity isn't verified.

Protect the file:

```bash
chmod 600 ~/fynlo/apps/server/.env
```

## 6. Build and start

The web app calls the API at the same address, so its API URL is the path `/v1`:

```bash
cd ~/fynlo
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_URL=/v1 pnpm build
pnpm --filter @fynlo/server db:migrate
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` prints one `sudo` command. Run it so the apps start again after a reboot.

## 7. Turn on HTTPS

```bash
sudo sed "s/FYNLO_SITE/IP_VPS.sslip.io/" ~/fynlo/deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Open `https://IP_VPS.sslip.io`. If the certificate fails, check the reason with `sudo journalctl -u caddy --since "10 min ago"`. Ports 80 and 443 also have to be open in the VPS provider's own firewall, if it has one.

## 8. Check it

```bash
curl https://IP_VPS.sslip.io/v1/health/ready
pm2 status
```

Then sign in and try each of these:

- Add and delete a transaction.
- Import a statement PDF.
- Follow `docs/gmail-ingest.md`, using `https://IP_VPS.sslip.io/v1` as the API address.

## Updating

Run this on the server:

```bash
~/fynlo/deploy/deploy.sh
```

It stops before restarting the apps if anything fails, and checks that both apps respond afterward.

## Automatic deploys

`.github/workflows/ci-cd.yml` checks every pull request and every push to `main`. After a passing push to `main`, it runs `deploy/deploy.sh` on the server. Finish steps 1 to 8 first, because this only updates a server that already works.

1. On your laptop, create a key used only by GitHub, without a passphrase:

   ```powershell
   ssh-keygen -t ed25519 -N '""' -C "fynlo-actions" -f "$HOME\.ssh\fynlo_actions"
   Get-Content "$HOME\.ssh\fynlo_actions.pub"
   ```

   In Windows PowerShell 5.1, `-N '""'` means an empty passphrase. If it asks for one anyway, press Enter twice.

2. On the server, allow that key to run only the deploy script. Replace `PUBLIC_KEY` with the line from step 1:

   ```bash
   echo 'restrict,command="/home/deploy/fynlo/deploy/deploy.sh" PUBLIC_KEY' >> ~/.ssh/authorized_keys
   ```

3. On your laptop, get the server's identity, so GitHub can detect a fake server:

   ```powershell
   ssh-keyscan -t ed25519 IP_VPS
   ```

4. In GitHub, open **Settings → Secrets and variables → Actions**. Add these under **Secrets**:

   | Name              | Value                                                          |
   | ----------------- | -------------------------------------------------------------- |
   | `VPS_HOST`        | The server's IP address                                        |
   | `VPS_USER`        | The app user                                                   |
   | `VPS_SSH_KEY`     | The whole contents of `fynlo_actions`, the file without `.pub` |
   | `VPS_KNOWN_HOSTS` | The output of step 3                                           |

5. Under **Variables**, add `DEPLOY_ENABLED` with the value `true`. Until then, the pipeline only runs its checks.

6. Delete `fynlo_actions` from your laptop, or keep it somewhere safe. GitHub has its own copy, and you can always create a new key.

To stop automatic deploys, set `DEPLOY_ENABLED` to `false`. If the key leaks, remove its line from `~/.ssh/authorized_keys`.

## If something goes wrong

| Problem                    | Where to look                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Page doesn't open          | `pm2 status`, then `sudo systemctl status caddy`                                   |
| API errors                 | `pm2 logs fynlo-api --lines 50`                                                    |
| Web errors                 | `pm2 logs fynlo-web --lines 50`                                                    |
| App restarts repeatedly    | `pm2 logs`, and `free -h` for memory                                               |
| Database certificate error | Remove `DATABASE_CA_PATH`, restart, and download the certificate again             |
| Automatic deploy fails     | The failed step in the repository's **Actions** tab, then `pm2 logs` on the server |

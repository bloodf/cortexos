# Install CortexOS with the Architect (Beginner Guide)

> The easiest way to install CortexOS. No coding required — just copy and paste.

---

## What You Need

Before we start, make sure you have:

- **A server running Ubuntu 24.04** — rent one cheaply from Hetzner, DigitalOcean, OVH, or any VPS provider
- **A computer with a terminal** — Mac, Linux, or Windows with PowerShell
- **An AI assistant account** — Claude, ChatGPT, Gemini, or any capable AI chatbot
- **About 1–2 hours** — most of which is waiting for things to download and install

---

## Step 1: Get a Server

A **server** is just a computer that runs 24/7 in someone else's data center. You rent it by the month.

### Recommended providers

| Provider | Price (approx.) | Why we like it |
|----------|-----------------|----------------|
| [Hetzner](https://www.hetzner.com/cloud/) | €5–10/month | Cheap, reliable, great performance |
| [DigitalOcean](https://www.digitalocean.com/) | $6–12/month | Beginner-friendly, good docs |
| [OVH](https://www.ovhcloud.com/) | €5–10/month | European, good value |

### Minimum specs

- **4 GB RAM** (8 GB recommended if you want to run AI tools)
- **50 GB disk** (SSD strongly recommended)
- **Ubuntu 24.04** as the operating system

When you rent the server, the provider will give you:
- An **IP address** (looks like `123.45.67.89`)
- A **root password** (a long random string)

Save both somewhere safe. You'll need them in the next step.

---

## Step 2: Connect to Your Server

**SSH** is a secure way to remote-control your server from your computer. It looks technical, but it's just a command that says "let me in."

Open the **Terminal** app on your Mac or Linux, or **PowerShell** on Windows.

Type this, but replace `YOUR_SERVER_IP` with the IP address your provider gave you:

```bash
ssh root@YOUR_SERVER_IP
```

Example:
```bash
ssh root@123.45.67.89
```

Press Enter. You'll be asked for the root password. Type it (you won't see anything on screen — that's normal for security) and press Enter again.

If you see a welcome message ending with a prompt like `root@your-server:~#`, you're in! 🎉

> 💡 **First time?** Your computer may ask if you trust the server. Type `yes` and press Enter.

---

## Step 3: Update Your Server

Before installing anything, let's make sure your server has the latest security patches.

At the prompt, type this exactly and press Enter:

```bash
apt update && apt upgrade -y
```

What this does:
- `apt update` — refreshes the list of available software
- `apt upgrade -y` — installs updates, automatically saying "yes" to prompts

This may take a few minutes. You'll see a lot of text scrolling by. That's normal — it's downloading updates.

---

## Step 4: Install Git

**Git** is a tool that downloads code from the internet. We need it to get CortexOS.

Run this command:

```bash
apt install -y git
```

Wait for it to finish. You should see `Done` at the end.

---

## Step 5: Clone CortexOS

Now we'll download the CortexOS repository (a fancy word for "project folder") onto your server.

Run these commands one at a time:

```bash
cd /opt
```

This moves you into the `/opt` directory, a standard place for installing software on Linux.

```bash
git clone https://github.com/bloodf/cortexos.git
```

This downloads CortexOS. It may take 30–60 seconds.

```bash
cd cortexos
```

This moves you into the newly downloaded `cortexos` folder.

---

## Step 6: Open the Install Checklist

CortexOS comes with a built-in checklist. Let's look at it:

```bash
cat prompts/tools/_order.md
```

This prints a numbered list of every installation step. Don't worry about understanding it all right now — the AI will explain each step as we go.

---

## Step 7: Start with the Preflight Check

The very first item in the checklist is `00-preflight.md`. This prompt makes sure your server is healthy before we install anything.

Here's how to use it:

1. **Read the prompt.** You can view it in your terminal:
   ```bash
   cat prompts/tools/00-preflight.md
   ```
   Or open it in your browser at:
   ```
   https://github.com/bloodf/cortexos/blob/main/prompts/tools/00-preflight.md
   ```

2. **Copy the entire contents** of the file — all the text.

3. **Paste it into your AI assistant** — open Claude, ChatGPT, Gemini, etc., and paste the whole thing into a new chat.

4. **The AI will ask you to run a command** — it'll give you something to type on your server. Copy it, paste it into your SSH session, press Enter, and tell the AI what happened.

5. **The AI will tell you if your server is ready.** If yes, move on. If no, it'll tell you what to fix.

> 💡 **Tip:** Keep two windows open side by side:
> - Your **terminal** (SSH session to the server)
> - Your **AI assistant** (browser or app)
>
> This makes copy-paste super fast.

---

## Step 8: Work Through the List

After preflight passes, continue down `_order.md` one item at a time.

For each prompt:

1. **Open the prompt file** — e.g., `prompts/tools/09-tmux.md`
2. **Copy the entire file contents**
3. **Paste into your AI assistant**
4. **Follow the AI's instructions exactly** — it'll tell you what commands to run
5. **Run the verification command** — every prompt ends with a way to check it worked
6. **Move to the next prompt**

### Example workflow

Let's say you're on step `09-tmux`:

- In your terminal, run: `cat prompts/tools/09-tmux.md`
- Select all the text, copy it
- Paste into your AI chat
- The AI says: *"Run this command: `apt install -y tmux`"*
- Switch to your terminal, type `apt install -y tmux`, press Enter
- The AI says: *"Now verify with: `tmux -V`"*
- Run `tmux -V` in your terminal, see the version number, tell the AI it worked
- Move to the next prompt!

> 🐢 **Go at your own pace.** There's no rush. If you're unsure about a command, ask your AI to explain it before running it.

---

## Step 9: Access Your Dashboard

When you reach `70-dashboard.md` and complete it, you'll have a working web dashboard.

If you set up a domain name during the Caddy step (`13-caddy.md`), you can visit:

```
https://your-domain.com
```

If you don't have a domain yet, your AI assistant will help you access it by IP address.

🎉 **Congratulations — you've just installed CortexOS!**

---

## Common Issues

| Problem | What it means | Quick fix |
|---------|---------------|-----------|
| `Permission denied` | You need administrator rights | Add `sudo` before the command: `sudo apt install ...` |
| `Command not found` | A required tool isn't installed | Check if the previous prompt completed. Re-run it if needed. |
| `Port already in use` | Another program is using that network port | Your AI assistant will help you find and stop the conflicting service. |
| `Connection refused` | The service hasn't started yet | Wait 30 seconds and try again. Some services take a moment to boot. |
| `apt is locked` | Another update is running in the background | Wait a minute, then try again. |

> 🆘 **Stuck?** Paste the exact error message into your AI assistant. It will know what to do.

---

## Next Steps

Now that CortexOS is installed, here's what to explore:

- **Add AI API keys** → see [`docs/AI-SETUP.md`](AI-SETUP.md)
- **Learn about your tools** → see [`docs/TOOLS.md`](TOOLS.md)
- **Need help?** → see [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md)

---

> 🌟 **You did it.** You installed a full self-hosted infrastructure stack with nothing but copy-and-paste. That's pretty amazing for a first-timer.

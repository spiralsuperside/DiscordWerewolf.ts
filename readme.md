# 🐺 Discord Werewolf Bot Server Setup (Ubuntu)

## ⚙️ System Setup

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

> ✅ You will be logged out. Wait a moment and log back into the server.

---

## 📦 Install Dependencies

```bash
sudo apt install -y ffmpeg git wget make g++
```

---

## 📥 Install NVM (Node Version Manager)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
```

> 🔁 After installation, exit and log back in to continue.

---

## 🟩 Install Latest Node.js LTS

```bash
nvm install --lts
```

---

## 📁 Clone the Project

```bash
git clone https://github.com/spiralsuperside/DiscordWerewolf.ts.git projects/DiscordWerewolf.ts
cd projects/DiscordWerewolf.ts
```

---

## 🧠 Create a Swap File (for installation support)

> 🔗 [Why? StackOverflow Answer](https://stackoverflow.com/a/71097715)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap  /swapfile
sudo swapon /swapfile
```

---

## 📦 Install App Dependencies

```bash
sudo npm install -g @dotenvx/dotenvx
sudo npm install
```

## 🔧 Install Dotenv (Similar to Dotenvx)
```bash
sudo npm install dotenv
```

---

## 🔓 Open Port 3000 on IPv4 Firewall

> Go to **AWS Console > EC2 > Security Groups > Inbound Rules**  
> Add **Custom TCP Rule**:  
> - Port: `3000`  
> - Source: `0.0.0.0/0` or your IP

---


## 🔧 Compile to JavaScript

```bash
npx tsc
```

---

## 🚀 Install and Use PM2 (Recommended)

```bash
sudo npm install -g pm2
```

Run the bot:

```bash
pm2 start build/index.js --name werewolf
```

To save the process on reboot:

```bash
pm2 save
pm2 startup
```

Follow the printed instructions (usually copy-paste the command provided).

---

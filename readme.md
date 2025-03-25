SETUP SERVER
`sudo apt update
sudo apt upgrade -y
sudo reboot`

# You will be logged out. Wait a moment and log back into the server

# Install dependencies
`sudo apt install -y ffmpeg git wget make g++`

# Install NVM. After install, exit and log back in to continue
`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash`

# Install latest version of Node
`nvm install --lts`

# Clone project
``git clone https://github.com/TumoiYorozu/DiscordWerewolf.ts.git projects/DiscordWerewolf.ts
cd projects/DiscordWerewolf.ts``

# Create swap file for installation
# https://stackoverflow.com/a/71097715
``sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap  /swapfile
sudo swapon /swapfile``

# Install app dependencies
``sudo npm install -g @dotenvx/dotenvx
sudo npm install``

# Configure env vars

DISCORD_WEREWOLF_BOT_TOKEN_1=token1
DISCORD_WEREWOLF_BOT_TOKEN_2=token2

DISCORD_WEREWOLF_HTTP_ADDR= Ubuntu Server IP
DISCORD_WEREWOLF_HTTP_IP= Ubuntu Server IP
DISCORD_WEREWOLF_HTTP_PORT=3000
DISCORD_WEREWOLF_SYSTEM_GM="MEMBER_ID_1 MEMBER_ID_2"

🛠 If You're Using Bash (.bashrc)
To permanently set your environment variable for your bot:

Open your .bashrc file:

`nano ~/.bashrc`
Scroll to the bottom and add the following line (replace with your actual token):

`export DISCORD_WEREWOLF_BOT_TOKEN_1=your_real_token_here`

Save and exit the file:

Press Ctrl + O, then Enter to save
Press Ctrl + X to exit

Apply the changes to your current shell session:

`source ~/.bashrc`

✅ Test it worked:
`echo $DISCORD_WEREWOLF_BOT_TOKEN_1`
You should see your token printed back.



add custom tcp 3000 rule to IPv4 Firewall (Networking)


# Compile to JS
`npx tsc`

`sudo npm install -g pm2`

# Run app
`pm2 start build/index.js --name werewolf`

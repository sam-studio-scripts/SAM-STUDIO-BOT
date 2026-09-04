SAM STUDIO BOT - RAILWAY DEPLOYMENT

1. Extract SAM-STUDIO-BOT-COMPLETE.zip on your computer.
2. Open the root of your GitHub SAM-STUDIO-BOT repository.
3. Upload all four project files, replacing files with the same names:
   - index.js
   - package.json
   - package-lock.json
   - SAM-STUDIO.png
4. Commit the changes to the branch connected to Railway (normally main).
5. Railway will rebuild and start the bot automatically.

Do not upload your .env file or bot token to GitHub.
The bot token and other secrets must stay in Railway Variables.

Required welcome-channel permissions:
- View Channel
- Send Messages
- Embed Links
- Attach Files

Welcome layout:
- Plain one-line welcome text
- Large standalone 3:1 banner attachment
- No embed box, purple side bar, duplicate title, or footer

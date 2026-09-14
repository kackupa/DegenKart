# Telegram Mini App setup

Pepecoin Kart is a normal web app first and can later be opened inside Telegram.

1. Create a bot with `@BotFather` using `/newbot` and keep the bot token private.
2. Deploy this project to Vercel and note the HTTPS URL.
3. In BotFather, use `/setmenubutton` (or the Mini App configuration in BotFather) and set that URL as the web app.
4. Open the bot in Telegram and tap the menu button. Telegram supplies `window.Telegram.WebApp` to the same frontend.
5. Test portrait and fullscreen viewport behavior on iOS and Android.

The app must remain usable at its public URL without Telegram. Telegram identity integration is intentionally lightweight and should be added only when the server has authoritative multiplayer sessions.

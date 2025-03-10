import { Log, ClientSingleton, PrismaSingleton } from "./Globals"
import { registerCommands } from "./commandRegister"
import { setupReactionRoleManager } from "./reactionRoleManager"
import { startWebServer } from './webserver';

Log.debug("Environment validation passed, connecting to database...")
await PrismaSingleton.$connect()

if (process.env.REGISTER_CMDS === "true") {
    await registerCommands()
}

const client = ClientSingleton
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  
  // Setup reaction role manager
  setupReactionRoleManager(client);
  
  // Start web UI server
  const PORT = parseInt(process.env.WEB_UI_PORT || '3000');
  startWebServer(client, PORT);
});
  console.log(`Logged in as ${client.user?.tag}!`);

Log.info("Client ready, logging in...")
ClientSingleton.login(process.env.DISCORD_TOKEN)

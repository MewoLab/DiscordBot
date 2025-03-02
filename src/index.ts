import { Log, ClientSingleton, PrismaSingleton } from "./Globals"
import { registerCommands } from "./commandRegister"
import { setupReactionRoleManager } from "./reactionRoleManager"

Log.debug("Environment validation passed, connecting to database...")
await PrismaSingleton.$connect()

if (process.env.REGISTER_CMDS === "true") {
    await registerCommands()
}

const client = ClientSingleton
const manager = setupReactionRoleManager(client);

Log.info("Client ready, logging in...")
ClientSingleton.login(process.env.DISCORD_TOKEN)

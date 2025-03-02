import { Client, Snowflake } from "discord.js"
import { ReactionRole, ReactionRoleConfiguration } from "discordjs-reaction-role"

export const setupReactionRoleManager = (client: Client) => {
    console.log("Setting up reaction role manager...");
    
    const messageEnv = process.env.MESSAGE;
    if (!messageEnv) {
      throw new Error("Missing required environment variable: MESSAGE");
    }
    const MESSAGE: Snowflake = messageEnv;
    const roleEnv = process.env.ROLE;
    if (!roleEnv) {
      throw new Error("Missing required environment variable: ROLE");
    }
    const ROLE: Snowflake = roleEnv;
    
    console.log(`Using message ID: ${MESSAGE}`);
    console.log(`Using role ID: ${ROLE}`);
    
    const configuration: ReactionRoleConfiguration[] = [
        {
            messageId: MESSAGE,
            reaction: "🍕",
            roleId: ROLE,
        },
    ];
    
    const reactionRoleManager = new ReactionRole(client, configuration);
    console.log("Reaction role manager setup complete");
    
    return reactionRoleManager;
};

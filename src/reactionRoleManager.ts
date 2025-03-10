import { Client, Snowflake, TextChannel, Message, GuildMember } from "discord.js"
import { ReactionRole as DiscordReactionRole, ReactionRoleConfiguration } from "discordjs-reaction-role"
import { PrismaClient } from "@prisma/client"

// Create a new Prisma client instance
const prisma = new PrismaClient()

// Keep track of attached listeners
let listenersAttached = false;

export const setupReactionRoleManager = async (client: Client) => {
    console.log("Setting up reaction role manager...");
    
    // Fetch reaction role configurations from database using prisma
    const reactionRoleConfigs = await prisma.ReactionRole.findMany({
        select: {
            id: true,
            messageId: true,
            roleId: true,
            reaction: true
            // Don't include fields that might be missing
        }
    });
    
    if (reactionRoleConfigs.length === 0) {
        console.log("No reaction role configurations found in database");
        return null;
    }
    
    // Convert database entries to ReactionRoleConfiguration format
    const configuration: ReactionRoleConfiguration[] = reactionRoleConfigs.map((config: { messageId: string; roleId: string; reaction: { toString: () => any } }) => {
        console.log(`Loading reaction role config: message=${config.messageId}, role=${config.roleId}, reaction=${config.reaction}`);
        return {
            messageId: config.messageId as Snowflake,
            reaction: config.reaction.toString(),
            roleId: config.roleId as Snowflake,
        };
    });
    
    // Add missing reactions to messages
    await addMissingReactions(client, configuration);
    
    // Create the reaction role manager
    const reactionRoleManager = new DiscordReactionRole(client, configuration);
    
    // Only attach event listeners once
    if (!listenersAttached) {
        // Remove existing listeners first to be safe
        client.removeAllListeners('messageReactionAdd');
        client.removeAllListeners('messageReactionRemove');
        
        // Now attach our listeners
        attachReactionRoleEventListeners(client);
        listenersAttached = true;
    }
    
    console.log(`Reaction role manager setup complete with ${configuration.length} configurations`);
    
    return reactionRoleManager;
};

// Modified function to attach event listeners to the client directly
// Important: No longer takes reactionRoleManager as parameter
function attachReactionRoleEventListeners(client: Client) {
    // Listen for the roleAdd event
    client.on('messageReactionAdd', async (reaction, user) => {
        try {
            if (user.bot) return; // Ignore bot reactions
            
            const { message } = reaction;
            if (!message.guild) return; // Only process guild messages
            
            // Find if this reaction is configured for a role
            const config = await prisma.ReactionRole.findFirst({
                where: {
                    messageId: message.id,
                    reaction: reaction.emoji.id 
                        ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>` 
                        : reaction.emoji.name
                },
                select: {
                    messageId: true,
                    roleId: true,
                    reaction: true
                }
            });
            
            if (!config) return; // Not a configured reaction role
            
            // Get the member who reacted
            const member = await message.guild.members.fetch(user.id).catch(() => null);
            if (!member) return;
            
            try {
                const role = await message.guild.roles.fetch(config.roleId).catch(() => null);
                if (!role) return;
                
                // IMPORTANT FIX: Actually assign the role
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    console.log(`✅ Role added: "${role.name}" assigned to ${member.user.tag} from reaction ${reaction.emoji.toString()} on message ${message.id}`);
                }
            } catch (error) {
                console.error('Error assigning role:', error);
            }
        } catch (error) {
            console.error('Error in reaction add event handler:', error);
        }
    });
    
    // Listen for the roleRemove event (similar changes as above)
    client.on('messageReactionRemove', async (reaction, user) => {
        try {
            if (user.bot) return; // Ignore bot reactions
            
            const { message } = reaction;
            if (!message.guild) return; // Only process guild messages
            
            // Find if this reaction is configured for a role
            const config = await prisma.ReactionRole.findFirst({
                where: {
                    messageId: message.id,
                    reaction: reaction.emoji.id 
                        ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>` 
                        : reaction.emoji.name
                },
                select: {
                    messageId: true,
                    roleId: true,
                    reaction: true
                }
            });
            
            if (!config) return; // Not a configured reaction role
            
            // Get the member who reacted
            const member = await message.guild.members.fetch(user.id).catch(() => null);
            if (!member) return;
            
            try {
                const role = await message.guild.roles.fetch(config.roleId).catch(() => null);
                if (!role) return;
                
                // Remove the role if they have it
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    console.log(`❌ Role removed: "${role.name}" removed from ${member.user.tag} by removing reaction ${reaction.emoji.toString()} on message ${message.id}`);
                }
            } catch (error) {
                console.error('Error removing role:', error);
            }
        } catch (error) {
            console.error('Error in reaction remove event handler:', error);
        }
    });
    
    // Set max listeners to avoid warnings
    // If you expect to have many listeners, increase this number
    client.setMaxListeners(20);
    
    console.log('Reaction role event listeners attached');
}

// Function to add missing reactions to messages
async function addMissingReactions(client: Client, configs: ReactionRoleConfiguration[]) {
    // Group configurations by message ID for efficiency
    const messageConfigs = new Map<Snowflake, { reaction: string, roleId: Snowflake }[]>();
    
    configs.forEach(config => {
        if (!messageConfigs.has(config.messageId)) {
            messageConfigs.set(config.messageId, []);
        }
        messageConfigs.get(config.messageId)?.push({
            reaction: config.reaction.toString(),
            roleId: config.roleId
        });
    });
    
    // Process each message
    for (const [messageId, configsForMessage] of messageConfigs.entries()) {
        try {
            // Find the message across all accessible channels
            let targetMessage: Message | null = null;
            
            for (const guild of client.guilds.cache.values()) {
                if (targetMessage) break;
                
                // Helper to find a message across all accessible channels in all guilds
                async function findMessage(client: Client, messageId: Snowflake): Promise<Message | null> {
                    for (const guild of client.guilds.cache.values()) {
                        const channels = guild.channels.cache.filter(
                            channel => channel.isTextBased() && !channel.isThread()
                        );
                        for (const channel of channels.values()) {
                            try {
                                const textChannel = channel as TextChannel;
                                const message = await textChannel.messages.fetch(messageId).catch(() => null);
                                if (message) {
                                    console.log(`Found message ${messageId} in channel #${textChannel.name} (${textChannel.id})`);
                                    return message;
                                }
                            } catch (error) {
                                // Skip channels where we don't have permission
                            }
                        }
                    }
                    console.log(`Could not find message ${messageId} in any channel`);
                    return null;
                }

                // Replace the nested loops with:
                targetMessage = await findMessage(client, messageId);
                if (!targetMessage) continue;
                
                for (const channel of guild.channels.cache.values()) {
                    try {
                        const textChannel = channel as TextChannel;
                        const message = await textChannel.messages.fetch(messageId).catch(() => null);
                        if (message) {
                            targetMessage = message;
                            console.log(`Found message ${messageId} in channel #${textChannel.name} (${textChannel.id})`);
                            break;
                        }
                    } catch (error) {
                        // Skip channels where we don't have permission
                    }
                }
            }
            
            if (!targetMessage) {
                console.log(`Could not find message ${messageId} in any channel`);
                continue;
            }
            
            // Check and add missing reactions
            const existingReactions = targetMessage.reactions.cache.map(r => 
                r.emoji.id ? `<:${r.emoji.name}:${r.emoji.id}>` : r.emoji.name
            );
            
            for (const config of configsForMessage) {
                const reactionExists = existingReactions.some(existing => 
                    existing === config.reaction || 
                    existing === config.reaction.replace(/^<a:/, '<:')  // Handle animated vs. static emojis
                );
                
                if (!reactionExists) {
                    console.log(`Adding missing reaction ${config.reaction} to message ${messageId}`);
                    try {
                        // Handle custom emoji format <:name:id> or <a:name:id>
                        if (config.reaction.startsWith('<') && config.reaction.endsWith('>')) {
                            const match = config.reaction.match(/<a?:([^:]+):(\d+)>/);
                            if (match) {
                                const emojiId = match[2];
                                await targetMessage.react(emojiId);
                            }
                        } else {
                            await targetMessage.react(config.reaction);
                        }
                        console.log(`Successfully added reaction ${config.reaction} to message ${messageId}`);
                    } catch (error) {
                        console.error(`Failed to add reaction ${config.reaction} to message ${messageId}:`, error);
                    }
                    
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error(`Error processing message ${messageId}:`, error);
        }
    }
}

// Helper function to add a new reaction role configuration
export const addReactionRole = async (messageId: Snowflake, roleId: Snowflake, reaction: string, client?: Client) => {
    // Use raw SQL to avoid issues with missing fields
    await prisma.$executeRaw`
        INSERT INTO ReactionRole (messageId, roleId, reaction)
        VALUES (${messageId}, ${roleId}, ${reaction})
    `;
    
    console.log(`Added new reaction role: message=${messageId}, role=${roleId}, reaction=${reaction}`);
    
    // If client is provided, add the reaction to the message immediately
    if (client) {
        try {
            // Find the message across all accessible channels
            let targetMessage: Message | null = null;
            
            for (const guild of client.guilds.cache.values()) {
                if (targetMessage) break;
                
                const channels = guild.channels.cache.filter(
                    channel => channel.isTextBased() && !channel.isThread()
                );
                
                for (const channel of channels.values()) {
                    try {
                        const textChannel = channel as TextChannel;
                        const message = await textChannel.messages.fetch(messageId).catch(() => null);
                        if (message) {
                            targetMessage = message;
                            break;
                        }
                    } catch (error) {
                        // Skip channels where we don't have permission
                    }
                }
            }
            
            if (!targetMessage) {
                console.log(`Could not find message ${messageId} in any channel`);
                return;
            }
            
            // Add the reaction to the message
            if (reaction.startsWith('<') && reaction.endsWith('>')) {
                const match = reaction.match(/<a?:([^:]+):(\d+)>/);
                if (match) {
                    const emojiId = match[2];
                    await targetMessage.react(emojiId);
                }
            } else {
                await targetMessage.react(reaction);
            }
            console.log(`Added reaction ${reaction} to message ${messageId}`);
        } catch (error) {
            console.error(`Failed to add reaction ${reaction} to message ${messageId}:`, error);
        }
    }
};

// Helper function to remove a reaction role configuration
export const removeReactionRole = async (messageId: Snowflake, roleId: Snowflake) => {
    const result = await prisma.ReactionRole.deleteMany({
        where: {
            messageId,
            roleId
        }
    });
    
    if (result.count > 0) {
        console.log(`Removed reaction role: message=${messageId}, role=${roleId}`);
        return true;
    }
    
    console.log(`No reaction role found for message=${messageId}, role=${roleId}`);
    return false;
};
function endsWith(arg0: string) {
    throw new Error("Function not implemented.");
}


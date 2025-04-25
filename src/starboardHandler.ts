import { Client, MessageReaction, User, TextChannel, EmbedBuilder, PartialMessageReaction, PartialUser } from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIN_STARS = 2;

export const setupStarboardHandler = (client: Client) => {
    client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        if (reaction.partial) await reaction.fetch();
        if (user.partial) await user.fetch();
        if (reaction.emoji.name === '⭐') {
            if (reaction instanceof MessageReaction) {
                if (!user.partial) {
                    await handleStarboardAdd(reaction, user);
                }
            }
        }
    });

    client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        if (reaction.partial) await reaction.fetch();
        if (user.partial) await user.fetch();
        if (reaction.emoji.name === '⭐') {
            await handleStarboardRemove(reaction as MessageReaction, user as User);
        }
    });
};

const handleStarboardAdd = async (reaction: MessageReaction, user: User) => {
    const { message } = reaction;
    const starboardChannel = message.guild?.channels.cache.find(channel => channel.name === 'starboard') as TextChannel;

    if (!starboardChannel || !message.author) return;

    const existingEntry = await prisma.starboard.findUnique({
        where: { messageId: message.id }
    });

    // Count the number of unique users who have starred the message (excluding the bot)
    const starCount = (await reaction.users.fetch()).filter(u => !u.bot).size;

    if (existingEntry) {
        // Only update if we meet the minimum star requirement
        if (starCount >= MIN_STARS) {
            await prisma.starboard.update({
                where: { id: existingEntry.id },
                data: { count: starCount }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId).catch(() => null);
            if (starboardMessage && typeof starboardMessage.edit === 'function') {
                const embed = starboardMessage.embeds && starboardMessage.embeds.length > 0 ? starboardMessage.embeds[0] : undefined;
                if (embed) {
                    embed.fields[0].value = `${starCount} ⭐`;
                    await starboardMessage.edit({ embeds: [embed] });
                } else {
                    const newEmbed = new EmbedBuilder()
                        .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() || '' })
                        .setDescription(message.content || 'No content')
                        .addFields({ name: 'Stars', value: `${starCount} ⭐` })
                        .setTimestamp();
                    await starboardMessage.edit({ embeds: [newEmbed] });
                }
            }
        }
    } else {
        // Only create if we meet the minimum star requirement
        if (starCount >= MIN_STARS) {
            try {
                // Create the DB entry first
                const created = await prisma.starboard.create({
                    data: {
                        messageId: message.id,
                        starboardMessageId: '', // placeholder, will update after sending embed
                        count: starCount
                    }
                });

                // Now send the embed
                const embed = new EmbedBuilder()
                    .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() || '' })
                    .setDescription(message.content || 'No content')
                    .addFields({ name: 'Stars', value: `${starCount} ⭐` })
                    .setTimestamp();

                const starboardMessage = await starboardChannel.send({ embeds: [embed] });

                // Update the DB entry with the starboard message ID
                await prisma.starboard.update({
                    where: { id: created.id },
                    data: { starboardMessageId: starboardMessage.id }
                });

            } catch (error: any) {
                if (error.code === 'P2002') {
                    // Entry was created by another process, so update instead
                    const entry = await prisma.starboard.findUnique({
                        where: { messageId: message.id }
                    });
                    if (entry) {
                        await prisma.starboard.update({
                            where: { id: entry.id },
                            data: { count: starCount }
                        });
                        const starboardMessage = await starboardChannel.messages.fetch(entry.starboardMessageId).catch(() => null);
                        if (starboardMessage && typeof starboardMessage.edit === 'function') {
                            const embed = starboardMessage.embeds && starboardMessage.embeds.length > 0 ? starboardMessage.embeds[0] : undefined;
                            if (embed) {
                                embed.fields[0].value = `${starCount} ⭐`;
                                await starboardMessage.edit({ embeds: [embed] });
                            } else {
                                const newEmbed = new EmbedBuilder()
                                    .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() || '' })
                                    .setDescription(message.content || 'No content')
                                    .addFields({ name: 'Stars', value: `${starCount} ⭐` })
                                    .setTimestamp();
                                await starboardMessage.edit({ embeds: [newEmbed] });
                            }
                        }
                    }
                } else {
                    throw error;
                }
            }
        }
    }
};

const handleStarboardRemove = async (reaction: MessageReaction, user: User) => {
    const { message } = reaction;
    const starboardChannel = message.guild?.channels.cache.find(channel => channel.name === 'starboard') as TextChannel;

    if (!starboardChannel) return;

    const existingEntry = await prisma.starboard.findUnique({
        where: { messageId: message.id }
    });

    // Count the number of unique users who have starred the message (excluding the bot)
    const starCount = (await reaction.users.fetch()).filter(u => !u.bot).size;

    if (existingEntry) {
        if (starCount <= 0) {
            // Delete the starboard entry and the embed if stars drop to 0
            await prisma.starboard.delete({
                where: { messageId: message.id }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId).catch(() => null);
            if (starboardMessage) {
                await starboardMessage.delete().catch(() => null);
            }
        } else if (starCount < MIN_STARS) {
            // If stars drop below minimum, also delete the embed and DB entry
            await prisma.starboard.delete({
                where: { messageId: message.id }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId).catch(() => null);
            if (starboardMessage) {
                await starboardMessage.delete().catch(() => null);
            }
        } else {
            await prisma.starboard.update({
                where: { messageId: message.id },
                data: { count: starCount }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId).catch(() => null);
            if (starboardMessage) {
                const embed = starboardMessage.embeds && starboardMessage.embeds.length > 0 ? starboardMessage.embeds[0] : undefined;
                if (embed && embed.fields && embed.fields.length > 0) {
                    embed.fields[0].value = `${starCount} ⭐`;
                    await starboardMessage.edit({ embeds: [embed] });
                } else {
                    const newEmbed = new EmbedBuilder()
                        .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() || '' })
                        .setDescription(message.content || 'No content')
                        .addFields({ name: 'Stars', value: `${starCount} ⭐` })
                        .setTimestamp();
                    await starboardMessage.edit({ embeds: [newEmbed] });
                }
            }
        }
    }
};

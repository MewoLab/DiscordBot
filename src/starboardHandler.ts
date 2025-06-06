import { Client, MessageReaction, User, TextChannel, EmbedBuilder, PartialMessageReaction, PartialUser } from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIN_STARS = 2;

export const setupStarboardHandler = (client: Client) => {
    client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            if (reaction.partial) await reaction.fetch();
            if (user.partial) await user.fetch();
            if (reaction.emoji.name === '⭐') {
                console.log(`Reaction added by ${user.tag || 'Unknown User'} on message ${reaction.message.id}`);
                if (reaction instanceof MessageReaction) {
                    if (!user.partial) {
                        await handleStarboardAdd(reaction, user);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling messageReactionAdd:', error);
        }
    });

    client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            if (reaction.partial) await reaction.fetch();
            if (user.partial) await user.fetch();
            if (reaction.emoji.name === '⭐') {
                console.log(`Reaction removed by ${user.tag || 'Unknown User'} on message ${reaction.message.id}`);
                await handleStarboardRemove(reaction as MessageReaction, user as User);
            }
        } catch (error) {
            console.error('Error handling messageReactionRemove:', error);
        }
    });
};

const handleStarboardAdd = async (reaction: MessageReaction, user: User) => {
    const { message } = reaction;
    const starboardChannel = message.guild?.channels.cache.find(channel => channel.name === 'starboard') as TextChannel;

    if (!starboardChannel || !message.author) {
        console.warn('Starboard channel or message author not found.');
        return;
    }

    console.log(`Handling starboard add for message ${message.id} by ${message.author.tag}`);
    const existingEntry = await prisma.starboard.findUnique({
        where: { messageId: message.id }
    });

    const starCount = (await reaction.users.fetch()).filter(u => !u.bot).size;

    const firstAttachment = message.attachments.first();
    const isVideo = firstAttachment?.contentType?.startsWith('video');

    if (existingEntry) {
        if (starCount >= MIN_STARS) {
            console.log(`Updating starboard entry for message ${message.id} with ${starCount} stars.`);
            await prisma.starboard.update({
                where: { id: existingEntry.id },
                data: { count: starCount }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId).catch(() => null);
            if (starboardMessage && typeof starboardMessage.edit === 'function') {
                console.log(`Editing starboard message for message ${message.id}.`);
                const embed = starboardMessage.embeds && starboardMessage.embeds.length > 0 ? starboardMessage.embeds[0] : undefined;
                if (embed) {
                    embed.fields[0].value = `${starCount} ⭐`;
                    await starboardMessage.edit({ embeds: [embed] });
                } else {
                    const newEmbed = new EmbedBuilder()
                        .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() || '' })
                        .setDescription(
                            message.content && message.content.trim() !== '' 
                                ? message.content 
                                : message.attachments.size > 0 
                                    ? isVideo 
                                        ? 'This message contains a video.' 
                                        : 'This message contains attachments.' 
                                    : 'No content'
                        )
                        .addFields(
                            { name: 'Stars', value: `${starCount} ⭐` },
                            { name: 'Jump to Message', value: `[Click here](https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id})` }
                        )
                        .setTimestamp();
                    if (isVideo) {
                        console.log(`Handling video for message ${message.id}`);
                        // Send the embed first
                        const embedMessage = await starboardChannel.send({ embeds: [newEmbed] });

                        if (firstAttachment?.size && firstAttachment.size > 8 * 1024 * 1024) { // 8 MB limit
                            console.warn(`Video file too large to send for message ${message.id}. Sending link instead.`);
                            await starboardChannel.send(`Video: ${firstAttachment.url}`);
                        } else if (firstAttachment?.url) {
                            console.log(`Sending video for message ${message.id}`);
                            await starboardChannel.send({ files: [firstAttachment.url] });
                        }
                    } else {
                        // Send only the embed if no video
                        await starboardChannel.send({ embeds: [newEmbed] });
                    }
                }
            }
        }
    } else {
        if (starCount >= MIN_STARS) {
            console.log(`Creating new starboard entry for message ${message.id} with ${starCount} stars.`);
            try {
                const created = await prisma.starboard.create({
                    data: {
                        messageId: message.id,
                        starboardMessageId: '',
                        count: starCount
                    }
                });

                const embed = new EmbedBuilder()
                    .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() || '' })
                    .setDescription(
                        message.content && message.content.trim() !== '' 
                            ? message.content 
                            : message.attachments.size > 0 
                                ? isVideo 
                                    ? 'This message contains a video.' 
                                    : 'This message contains attachments.' 
                                : 'No content'
                    )
                    .addFields(
                        { name: 'Stars', value: `${starCount} ⭐` },
                        { name: 'Jump to Message', value: `[Click here](https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id})` }
                    )
                    .setTimestamp();

                if (isVideo) {
                    console.log(`Handling video for message ${message.id}`);
                    // Send the embed first
                    const embedMessage = await starboardChannel.send({ embeds: [embed] });

                    if (firstAttachment?.size && firstAttachment.size > 8 * 1024 * 1024) { // 8 MB limit
                        console.warn(`Video file too large to send for message ${message.id}. Sending link instead.`);
                        await starboardChannel.send(`Video: ${firstAttachment.url}`);
                    } else if (firstAttachment?.url) {
                        console.log(`Sending video for message ${message.id}`);
                        const starboardMessage = await starboardChannel.send({ 
                            files: [firstAttachment.url] 
                        });

                        await prisma.starboard.update({
                            where: { id: created.id },
                            data: { starboardMessageId: starboardMessage.id }
                        });
                    }
                } else {
                    const starboardMessage = await starboardChannel.send({ embeds: [embed] });

                    await prisma.starboard.update({
                        where: { id: created.id },
                        data: { starboardMessageId: starboardMessage.id }
                    });
                }
            } catch (error: any) {
                console.error('Error creating starboard entry:', error);
                if (error.code === 'P2002') {
                    console.warn('Duplicate entry detected, updating instead.');
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
                                    .setDescription(
                                        message.content && message.content.trim() !== '' 
                                            ? message.content 
                                            : message.attachments.size > 0 
                                                ? isVideo 
                                                    ? 'This message contains a video.' 
                                                    : 'This message contains attachments.' 
                                                : 'No content'
                                    )
                                    .addFields(
                                        { name: 'Stars', value: `${starCount} ⭐` },
                                        { name: 'Jump to Message', value: `[Click here](https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id})` }
                                    )
                                    .setTimestamp();
                                if (isVideo) {
                                    console.log(`Handling video for message ${message.id}`);
                                    // Send the embed first
                                    const embedMessage = await starboardChannel.send({ embeds: [newEmbed] });

                                    if (firstAttachment?.size && firstAttachment.size > 8 * 1024 * 1024) { // 8 MB limit
                                        console.warn(`Video file too large to send for message ${message.id}. Sending link instead.`);
                                        await starboardChannel.send(`Video: ${firstAttachment.url}`);
                                    } else if (firstAttachment?.url) {
                                        console.log(`Sending video for message ${message.id}`);
                                        await starboardChannel.send({ files: [firstAttachment.url] });
                                    }
                                } else {
                                    // Send only the embed if no video
                                    await starboardChannel.send({ embeds: [newEmbed] });
                                }
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

    if (!starboardChannel) {
        console.warn('Starboard channel not found.');
        return;
    }

    console.log(`Handling starboard remove for message ${message.id}`);
    const existingEntry = await prisma.starboard.findUnique({
        where: { messageId: message.id }
    });

    const starCount = (await reaction.users.fetch()).filter(u => !u.bot).size;

    if (existingEntry) {
        if (starCount <= 0) {
            console.log(`Deleting starboard entry for message ${message.id} as stars dropped to 0.`);
            await prisma.starboard.delete({
                where: { messageId: message.id }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId).catch(() => null);
            if (starboardMessage && typeof starboardMessage.delete === 'function') {
                await starboardMessage.delete().catch((error) => {
                    console.error(`Failed to delete starboard message for message ${message.id}:`, error);
                });
            }
        } else if (starCount < MIN_STARS) {
            console.log(`Deleting starboard entry for message ${message.id} as stars dropped below minimum.`);
            await prisma.starboard.delete({
                where: { messageId: message.id }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId).catch(() => null);
            if (starboardMessage && typeof starboardMessage.delete === 'function') {
                await starboardMessage.delete().catch((error) => {
                    console.error(`Failed to delete starboard message for message ${message.id}:`, error);
                });
            }
        } else {
            console.log(`Updating starboard entry for message ${message.id} with ${starCount} stars.`);
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

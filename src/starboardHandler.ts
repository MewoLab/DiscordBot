import { Client, MessageReaction, User, TextChannel, MessageEmbed } from 'discord.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const setupStarboardHandler = (client: Client) => {
    client.on('messageReactionAdd', async (reaction: MessageReaction, user: User) => {
        if (reaction.emoji.name === '⭐') {
            await handleStarboardAdd(reaction, user);
        }
    });

    client.on('messageReactionRemove', async (reaction: MessageReaction, user: User) => {
        if (reaction.emoji.name === '⭐') {
            await handleStarboardRemove(reaction, user);
        }
    });
};

const handleStarboardAdd = async (reaction: MessageReaction, user: User) => {
    const { message } = reaction;
    const starboardChannel = message.guild?.channels.cache.find(channel => channel.name === 'starboard') as TextChannel;

    if (!starboardChannel) return;

    const existingEntry = await prisma.starboard.findUnique({
        where: { messageId: message.id }
    });

    if (existingEntry) {
        await prisma.starboard.update({
            where: { messageId: message.id },
            data: { count: existingEntry.count + 1 }
        });

        const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId);
        const embed = starboardMessage.embeds[0];
        embed.fields[0].value = `${existingEntry.count + 1} ⭐`;
        await starboardMessage.edit({ embeds: [embed] });
    } else {
        const embed = new MessageEmbed()
            .setAuthor(message.author?.tag, message.author?.displayAvatarURL())
            .setDescription(message.content)
            .addField('Stars', '1 ⭐')
            .setTimestamp();

        const starboardMessage = await starboardChannel.send({ embeds: [embed] });

        await prisma.starboard.create({
            data: {
                messageId: message.id,
                starboardMessageId: starboardMessage.id,
                count: 1
            }
        });
    }
};

const handleStarboardRemove = async (reaction: MessageReaction, user: User) => {
    const { message } = reaction;
    const starboardChannel = message.guild?.channels.cache.find(channel => channel.name === 'starboard') as TextChannel;

    if (!starboardChannel) return;

    const existingEntry = await prisma.starboard.findUnique({
        where: { messageId: message.id }
    });

    if (existingEntry) {
        if (existingEntry.count === 1) {
            await prisma.starboard.delete({
                where: { messageId: message.id }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId);
            await starboardMessage.delete();
        } else {
            await prisma.starboard.update({
                where: { messageId: message.id },
                data: { count: existingEntry.count - 1 }
            });

            const starboardMessage = await starboardChannel.messages.fetch(existingEntry.starboardMessageId);
            const embed = starboardMessage.embeds[0];
            embed.fields[0].value = `${existingEntry.count - 1} ⭐`;
            await starboardMessage.edit({ embeds: [embed] });
        }
    }
};

import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import ISlashCommand from "./general";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default class StarboardCommand implements ISlashCommand {
    id = "starboard";

    async execute(interaction: ChatInputCommandInteraction) {
        const starredMessages = await prisma.starboard.findMany({
            orderBy: { count: "desc" },
            take: 10
        });

        if (starredMessages.length === 0) {
            await interaction.reply("No messages on the starboard yet.");
            return;
        }

        const embeds = starredMessages.map((entry) => {
            return {
                author: {
                    name: entry.messageId,
                },
                description: `Stars: ${entry.count} ⭐`,
                fields: [
                    {
                        name: "Jump to Message",
                        value: `[Click Here](https://discord.com/channels/${interaction.guildId}/${entry.channelId}/${entry.messageId})`,
                        inline: true,
                    },
                ],
                timestamp: new Date(),
            };
        });

        await interaction.reply({ embeds });
    }
}

export const starboardCommand = new SlashCommandBuilder()
    .setName("starboard")
    .setDescription("View the starboard")
    .toJSON();

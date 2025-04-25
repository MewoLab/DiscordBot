import { EmbedBuilder } from "discord.js";

const testEmbed = new EmbedBuilder()
    .setTitle("Test")
    .setDescription("This is a test embed")
    .setColor(0xFF0000) // RED color in hexadecimal
    .setTimestamp()
    .setFooter({ text: "Test footer" });

const createStarboardEmbed = (message, starCount) => {
    return new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content)
        .addFields(
            { name: 'Stars', value: `${starCount} ⭐`, inline: true },
            { name: 'Jump to Message', value: `[Click Here](https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id})`, inline: true }
        )
        .setTimestamp();
};

export default {
    testEmbed: testEmbed.toJSON(),
    createStarboardEmbed
};

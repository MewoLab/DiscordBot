import { EmbedBuilder } from "discord.js";

const testEmbed = new EmbedBuilder()
    .setTitle("Test")
    .setDescription("This is a test embed")
    .setColor(0xFF0000) // RED color in hexadecimal
    .setTimestamp()
    .setFooter({ text: "Test footer" });

// ...removed createStarboardEmbed and related code...

export default {
    testEmbed: testEmbed.toJSON()
    // ...removed createStarboardEmbed export...
};
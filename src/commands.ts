import { SlashCommandBuilder } from "discord.js"

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!"),
        new SlashCommandBuilder()
        .setName('games')
        .setDescription('FAQ for Sega\'s arcade games')
        .addSubcommand(subcommand =>
            subcommand
                .setName('chuni')
                .setDescription('Chunithm details')
                .addStringOption(option =>
                    option.setName('option')
                        .setDescription('Choose an option')
                        .setRequired(true)
                        .addChoices(
                            { name: 'oldest', value: 'oldest' },
                            { name: 'newest', value: 'newest' },
                            { name: 'faq', value: 'faq' },
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mai2')
                .setDescription('maimai details')
                .addStringOption(option =>
                    option.setName('option')
                        .setDescription('Choose an option')
                        .setRequired(true)
                        .addChoices(
                            { name: 'oldest', value: 'oldest' },
                            { name: 'newest', value: 'newest' },
                            { name: 'faq', value: 'faq' },
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mu3')
                .setDescription('Ongeki details')
                .addStringOption(option =>
                    option.setName('option')
                        .setDescription('Choose an option')
                        .setRequired(true)
                        .addChoices(
                            { name: 'oldest', value: 'oldest' },
                            { name: 'newest', value: 'newest' },
                            { name: 'faq', value: 'faq' },
                        ))),
    new SlashCommandBuilder()
        .setName("test")
        .setDescription("Test embeds")
].map(command => command.toJSON());

export default commands;
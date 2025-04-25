import { Client, GatewayIntentBits, Partials } from "discord.js"
import { ILogObj, Logger } from "tslog"
import ISlashCommand from "./interactions/general"
import PingCommand from "./interactions/ping"
import GamesCommand from "./interactions/games"
import TestEmbedCommand from "./interactions/test" 
import { Prisma, PrismaClient } from "@prisma/client"
import Configuration from "./configuration"
import { setupStarboardHandler } from './starboardHandler'

const minLevel = Configuration.emit.log_level

export const Log = new Logger<ILogObj>({ minLevel }),
    PrismaSingleton = new PrismaClient(),
    ClientSingleton = new Client({
        partials: [
            Partials.Message,
            Partials.Reaction
        ],
        intents: [
            GatewayIntentBits.Guilds, 
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
        ],
    }),
    commands: Record<string, ISlashCommand> = {}

commands.ping = new PingCommand()
commands.games = new GamesCommand()
commands.test = new TestEmbedCommand()

ClientSingleton.on("ready", () => {
    Log.info("Client ready.")
    setupStarboardHandler(ClientSingleton)
})

ClientSingleton.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) {
      return
    }

    const command = commands[interaction.commandName]

    if (!command) {
        Log.warn(`Command ${interaction.commandName} not found.`)
        interaction.reply({
            content: "Command not found.",
            ephemeral: true,
        })
        return
    }

    if (interaction.isChatInputCommand()) {
        command.execute(interaction)
    } else {
        Log.warn(`Interaction type ${typeof interaction} not supported.`)
        interaction.reply({
            content: "Interaction type not supported.",
            ephemeral: true,
        })
    }
})

import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import ISlashCommand from "./general";
const gameResponses: {
    [game: string]: {
      [option: string]: string;
      default: string;
    };
  } = {
    chuni: {
      oldest: "Chunithm oldest supported version: Chunithm NEW!! (2.00)",
      newest: "Chunithm newest supported version: Chunithm VERSE (2.30)",
      faq: "Chunithm FAQ: https://two-torial.xyz/games/chunithmluminousplus/troubleshooting/",
      default: "Unknown option selected for Chunithm."
    },
    mai2: {
      oldest: "maimai oldest supported version: maimai DX (1.00)",
      newest: "maimai newest supported version: maimai DX Prism Plus (1.55)",
      faq: "maimai FAQ https://two-torial.xyz/games/sega/maimaidx/prismplus/troubleshooting/",
      default: "Unknown option selected for maimai."
    },
    mu3: {
      oldest: "Ongeki oldest supported version: O.N.G.E.K.I. (1.00)",
      newest: "Ongeki newest supported version: O.N.G.E.K.I. ReFresh (1.50)",
      faq: "Ongeki FAQ: https://two-torial.xyz/games/ongekibrightmemory/troubleshooting/",
      default: "Unknown option selected for Ongeki."
    }
  };
  
  export default class GamesCommand implements ISlashCommand {
    id = "games";
  
    async execute(interaction: ChatInputCommandInteraction) {
      const subcommand = interaction.options.getSubcommand();
      const option = interaction.options.getString('option');
      const game = gameResponses[subcommand];
      const replyMessage = game ? (option && game[option] || game.default) : "Unknown game selected.";
      await interaction.reply(replyMessage);
    }
  }
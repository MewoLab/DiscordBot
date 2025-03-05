import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { Client } from 'discord.js';
import { db } from './database';
import { setupReactionRoleManager } from './reactionRoleManager';

export function startWebServer(client: Client, port: number = 3000) {
  // Initialize express app
  const app: Application = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // API Routes
  // Get all reaction roles
  app.get('/api/reaction-roles', async (req: Request, res: Response) => {
    try {
      const reactionRoles = await (await db.collection('reactionRoles').find({})).toArray();
      res.json(reactionRoles);
    } catch (error) {
      console.error('Failed to get reaction roles:', error);
      res.status(500).json({ error: 'Failed to get reaction roles' });
    }
  });

  // Create a new reaction role
  app.post('/api/reaction-roles', async (req: Request, res: Response) => {
    try {
      const { messageId, roleId, reaction } = req.body;
      
      // Validate input
      if (!messageId || !roleId || !reaction) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Insert into database
      await db.collection('reactionRoles').insertOne({
        messageId,
        roleId,
        reaction
      });

      // Reload reaction role manager
      await setupReactionRoleManager(client);
      
      res.status(201).json({ success: true, message: 'Reaction role created successfully' });
    } catch (error) {
      console.error('Failed to create reaction role:', error);
      res.status(500).json({ error: 'Failed to create reaction role' });
    }
  });

  // Delete a reaction role
  app.delete('/api/reaction-roles/:id', async (req: Request, res: Response) => {
    try {
      const result = await db.collection('reactionRoles').deleteOne({
        id: parseInt(req.params.id)
      });
      
      if (result.deletedCount > 0) {
        // Reload reaction role manager
        await setupReactionRoleManager(client);
        res.json({ success: true, message: 'Reaction role deleted successfully' });
      } else {
        res.status(404).json({ error: 'Reaction role not found' });
      }
    } catch (error) {
      console.error('Failed to delete reaction role:', error);
      res.status(500).json({ error: 'Failed to delete reaction role' });
    }
  });

  // Get available guilds, roles, and channels for the bot
  app.get('/api/discord/resources', async (req: Request, res: Response) => {
    try {
      const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        roles: guild.roles.cache
          .filter(role => !role.managed && role.name !== '@everyone')
          .map(role => ({ id: role.id, name: role.name, color: role.hexColor })),
        channels: guild.channels.cache
          .filter(channel => channel.isTextBased())
          .map(channel => ({ id: channel.id, name: channel.name }))
      }));
      
      res.json(guilds);
    } catch (error) {
      console.error('Failed to get Discord resources:', error);
      res.status(500).json({ error: 'Failed to get Discord resources' });
    }
  });

  // Add endpoint to get server emojis
  app.get('/api/discord/guild/:guildId/emojis', async (req: Request, res: Response) => {
    try {
      const guildId = req.params.guildId;
      const guild = client.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      
      const emojis = guild.emojis.cache.map(emoji => ({
        id: emoji.id,
        name: emoji.name,
        animated: emoji.animated,
        available: emoji.available
      }));
      
      res.json(emojis);
    } catch (error) {
      console.error('Failed to get guild emojis:', error);
      res.status(500).json({ error: 'Failed to get guild emojis' });
    }
  });

  // Serve frontend
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // Start server
  app.listen(port, () => {
    console.log(`Web UI running on port ${port}`);
  });

  return app;
}
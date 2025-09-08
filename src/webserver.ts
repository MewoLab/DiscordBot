import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { Client } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { setupReactionRoleManager } from './reactionRoleManager';

// Create a new Prisma client instance
const prisma = new PrismaClient();

// Authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const secretKey = process.env.WEB_UI_SECRET_KEY;
  
  if (!secretKey) {
    return res.status(500).json({ error: 'Server configuration error: No secret key configured' });
  }

  // Check for API key in headers, query params, or body
  const apiKey = req.headers['x-api-key'] || req.query.key || req.body?.key;
  
  if (!apiKey || apiKey !== secretKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }
  
  next();
};

// IP restriction middleware for admin functions
const restrictToIP = (allowedIP: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    
    // Get the real IP (handle proxies)
    const realIP = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIP;
    
    console.log(`Access attempt from IP: ${realIP}, Allowed IP: ${allowedIP}`);
    
    if (realIP !== allowedIP) {
      return res.status(403).json({ error: 'Access denied: IP not authorized' });
    }
    
    next();
  };
};

export function startWebServer(client: Client, port: number = 3000) {
  // Initialize express app
  const app: Application = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // API Routes (all protected with authentication)
  // Get all reaction roles
  app.get('/api/reaction-roles', authenticate, async (req: Request, res: Response) => {
    try {
      const reactionRoles = await prisma.ReactionRole.findMany();
      res.json(reactionRoles);
    } catch (error) {
      console.error('Failed to get reaction roles:', error);
      res.status(500).json({ error: 'Failed to get reaction roles' });
    }
  });

  // Create a new reaction role
  app.post('/api/reaction-roles', authenticate, async (req: Request, res: Response) => {
    try {
      const { messageId, roleId, reaction } = req.body;
      
      // Validate input
      if (!messageId || !roleId || !reaction) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Insert into database using Prisma
      await prisma.ReactionRole.create({
        data: {
          messageId,
          roleId,
          reaction
        }
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
  app.delete('/api/reaction-roles/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Delete using Prisma
      const result = await prisma.ReactionRole.delete({
        where: {
          id: id
        }
      });
      
      if (result) {
        // Reload reaction role manager
        await setupReactionRoleManager(client);
        res.json({ success: true, message: 'Reaction role deleted successfully' });
      } else {
        res.status(404).json({ error: 'Reaction role not found' });
      }
    } catch (error) {
      // Handle record not found error
      if ((error as any).code === 'P2025') {
        return res.status(404).json({ error: 'Reaction role not found' });
      }
      
      console.error('Failed to delete reaction role:', error);
      res.status(500).json({ error: 'Failed to delete reaction role' });
    }
  });

  // Get available guilds, roles, and channels for the bot
  app.get('/api/discord/resources', authenticate, async (req: Request, res: Response) => {
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
  app.get('/api/discord/guild/:guildId/emojis', authenticate, async (req: Request, res: Response) => {
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

  // Authentication endpoint for checking API key validity
  app.post('/api/auth/verify', (req: Request, res: Response) => {
    const secretKey = process.env.WEB_UI_SECRET_KEY;
    const apiKey = req.headers['x-api-key'] || req.query.key || req.body?.key;
    
    if (!secretKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    if (!apiKey || apiKey !== secretKey) {
      return res.status(401).json({ error: 'Invalid API key', valid: false });
    }
    
    res.json({ valid: true, message: 'API key is valid' });
  });

  // Admin-only routes (IP restricted)
  // Get guild members
  app.get('/api/admin/guild/:guildId/members', authenticate, restrictToIP(process.env.ADMIN_IP || '127.0.0.1'), async (req: Request, res: Response) => {
    try {
      const guildId = req.params.guildId;
      const guild = client.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      
      // Fetch all members (this may take time for large servers)
      await guild.members.fetch();
      
      const members = guild.members.cache.map(member => ({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        roles: member.roles.cache
          .filter(role => role.name !== '@everyone')
          .map(role => ({ id: role.id, name: role.name, color: role.hexColor }))
      }));
      
      res.json(members);
    } catch (error) {
      console.error('Failed to get guild members:', error);
      res.status(500).json({ error: 'Failed to get guild members' });
    }
  });

  // Remove role from user
  app.delete('/api/admin/guild/:guildId/member/:memberId/role/:roleId', authenticate, restrictToIP(process.env.ADMIN_IP || '127.0.0.1'), async (req: Request, res: Response) => {
    try {
      const { guildId, memberId, roleId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      
      const member = await guild.members.fetch(memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      await member.roles.remove(role);
      res.json({ success: true, message: `Removed role ${role.name} from ${member.displayName}` });
    } catch (error) {
      console.error('Failed to remove role:', error);
      res.status(500).json({ error: 'Failed to remove role' });
    }
  });

  // Add role to user
  app.post('/api/admin/guild/:guildId/member/:memberId/role/:roleId', authenticate, restrictToIP(process.env.ADMIN_IP || '127.0.0.1'), async (req: Request, res: Response) => {
    try {
      const { guildId, memberId, roleId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      
      const member = await guild.members.fetch(memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      await member.roles.add(role);
      res.json({ success: true, message: `Added role ${role.name} to ${member.displayName}` });
    } catch (error) {
      console.error('Failed to add role:', error);
      res.status(500).json({ error: 'Failed to add role' });
    }
  });

  // Admin page (IP restricted)
  app.get('/admin', restrictToIP(process.env.ADMIN_IP || '127.0.0.1'), authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
  });

  // Serve frontend (protected)
  app.get('/', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // Start server
  app.listen(port, () => {
    console.log(`Web UI running on port ${port}`);
  });

  return app;
}
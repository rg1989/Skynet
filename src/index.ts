import 'dotenv/config';
import { loadConfig } from './config/loader.js';
import { initializeRuntimeConfig, initializeDefaultToolStates } from './config/runtime.js';
import { createAppServer } from './server/http.js';
import { setScheduler, setAgentRunner, setProviderManager } from './server/routes.js';
import { createProviderManager } from './providers/index.js';
import { AgentRunner } from './agent/index.js';
import { createCoreSkillRegistry, initializeMemorySkills, initializeVisionSkills, initializeAudioSkills, initializeSelfConfigSkills } from './skills/index.js';
import { TelegramBot } from './telegram/index.js';
import { MemoryStore } from './memory/index.js';
import { Scheduler } from './scheduler/index.js';
import { detectPlatform, createHardwareAdapter } from './hardware/index.js';
import { mkdirSync, existsSync } from 'fs';

/**
 * Skynet Lite - Personal AI Assistant
 * Main entry point
 */

async function main(): Promise<void> {
  console.log('Starting Skynet Lite...');
  console.log('========================');

  // Load configuration
  let config;
  try {
    config = loadConfig();
    // Initialize runtime config manager
    initializeRuntimeConfig(config);
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }

  // Ensure data directory exists
  const dataDir = config.dataDir;
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory: ${dataDir}`);
  }

  // Create subdirectories
  const subdirs = ['sessions', 'media', 'scheduled'];
  for (const subdir of subdirs) {
    const path = `${dataDir}/${subdir}`;
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  // Create and start server
  const server = createAppServer(config);
  
  // Initialize provider manager
  const providerManager = createProviderManager(config);
  console.log(`Provider: ${config.providers.default}`);
  console.log(`Available providers: ${providerManager.getAvailable().join(', ')}`);

  // Get default provider
  let defaultProvider;
  try {
    defaultProvider = providerManager.getDefault();
    console.log(`Default provider initialized: ${defaultProvider.name}`);
  } catch (error) {
    console.error('Failed to initialize default provider:', error);
    console.log('Continuing without LLM provider - some features will be unavailable');
  }

  // Initialize memory system
  let memoryStore: MemoryStore | undefined;
  if (config.agent.memory?.enabled !== false) {
    try {
      memoryStore = new MemoryStore(config.dataDir);
      
      // Set up embedding function if provider supports it
      if (defaultProvider) {
        memoryStore.setEmbedFunction(async (text: string) => {
          try {
            const embeddingProvider = providerManager.getEmbeddingProvider();
            return await embeddingProvider.embed(text);
          } catch {
            // Fall back to text search if embeddings fail
            throw new Error('Embeddings not available');
          }
        });
      }
      
      initializeMemorySkills(memoryStore);
      const stats = memoryStore.getStats();
      console.log(`Memory system initialized: ${stats.factCount} facts, ${stats.memoryCount} memories`);
    } catch (error) {
      console.error('Failed to initialize memory system:', error);
    }
  }

  // Create agent runner (pass providerManager so it can dynamically switch providers)
  const agentRunner = new AgentRunner(
    config,
    providerManager,
    (type, payload) => server.wsHandler.broadcast(type, payload)
  );

  // Initialize hardware adapter
  const platform = detectPlatform();
  console.log(`Platform detected: ${platform}`);
  
  try {
    const hardwareAdapter = await createHardwareAdapter(platform, config.hardware);
    const capabilities = await hardwareAdapter.checkCapabilities();
    console.log(`Hardware capabilities: screenshot=${capabilities.screenshot}, webcam=${capabilities.webcam}, mic=${capabilities.microphone}, speaker=${capabilities.speaker}, tts=${capabilities.tts}`);
    
    // Initialize vision and audio skills with hardware adapter
    if (defaultProvider) {
      initializeVisionSkills(hardwareAdapter, defaultProvider, config.dataDir);
      initializeAudioSkills(hardwareAdapter, defaultProvider, config.dataDir);
      console.log('Vision and audio skills initialized');
    }
  } catch (error) {
    console.warn('Hardware initialization failed:', error);
    console.log('Vision and audio skills will not be available');
  }

  // Register core skills
  const skillRegistry = createCoreSkillRegistry();
  agentRunner.registerSkills(skillRegistry.getAll());
  console.log(`Skills registered: ${skillRegistry.count}`);

  // Initialize self-config skills with provider manager and skill names
  initializeSelfConfigSkills(providerManager, skillRegistry.getNames());
  console.log('Self-configuration skills initialized');

  // Initialize default tool states - all tools disabled except self-config
  initializeDefaultToolStates(skillRegistry.getNames());
  console.log('Default tool states: only self-config tools enabled');

  // Set agent runner and provider manager on routes for API
  setAgentRunner(agentRunner);
  setProviderManager(providerManager);

  // Initialize scheduler
  const scheduler = new Scheduler(
    config.dataDir,
    agentRunner,
    (type, payload) => server.wsHandler.broadcast(type as any, payload)
  );
  scheduler.start();
  setScheduler(scheduler);
  console.log(`Scheduler initialized with ${scheduler.getTasks().length} tasks`);

  // Initialize Telegram bot (if configured)
  let telegramBot: TelegramBot | undefined;
  if (config.telegram.botToken && config.telegram.botToken.length > 10) {
    try {
      telegramBot = new TelegramBot({
        config,
        agentRunner,
      });
      await telegramBot.start();
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
      console.log('Continuing without Telegram integration');
    }
  } else {
    console.log('Telegram bot not configured (set TELEGRAM_BOT_TOKEN)');
  }

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    
    scheduler.stop();
    
    if (telegramBot?.running) {
      await telegramBot.stop();
    }
    
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start the server
  await server.start();

  // Warmup the model (non-blocking)
  if (defaultProvider && 'warmup' in defaultProvider && typeof defaultProvider.warmup === 'function') {
    console.log('Warming up model...');
    defaultProvider.warmup().then(() => {
      console.log('Model warmup complete');
    }).catch((err: Error) => {
      console.warn('Model warmup failed:', err.message);
    });
  }

  // Log status
  const isDev = process.env.NODE_ENV !== 'production';
  console.log('');
  console.log('=== Skynet Lite Ready ===');
  console.log(`  API: http://${config.server.host}:${config.server.port}`);
  console.log(`  WebSocket: ws://${config.server.host}:${config.server.port}`);
  if (isDev) {
    console.log(`  Dev UI: http://localhost:5173 (hot reload)`);
  }
  console.log(`  Provider: ${config.providers.default}`);
  console.log(`  Telegram: ${telegramBot?.running ? 'connected' : 'not connected'}`);
  console.log(`  Skills: ${skillRegistry.count} loaded`);
  console.log(`  Memory: ${config.agent.memory?.enabled ? 'enabled' : 'disabled'}`);
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

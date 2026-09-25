const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Limit watchFolders to the mobile app and node_modules (exclude monorepo workers and website)
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, 'node_modules'),
];

// 2. Block Android build outputs, Gradle caches, and Kotlin compiler artifacts from Metro's file watcher
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList].filter(Boolean)),
  /.*[/\\]android[/\\]app[/\\]build[/\\].*/,
  /.*[/\\]android[/\\]\.gradle[/\\].*/,
  /.*[/\\]\.gradle[/\\].*/,
  /.*[/\\]build[/\\]kotlin[/\\].*/,
  /.*[/\\]gradle-plugin[/\\].*[/\\]build[/\\].*/,
  /.*[/\\]workers[/\\].*/,
  /.*[/\\]website[/\\].*/,
];

module.exports = config;

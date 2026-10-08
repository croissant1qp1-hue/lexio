const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, '..');

const config = getDefaultConfig(projectRoot);

/*
 * Phase 7 plant: der Client teilt lib/lernlogik.ts, lib/sprachen.ts und
 * lib/types.ts mit der Web-App, statt sie zu duplizieren. Diese Dateien
 * liegen eine Ebene ueber dem Projekt, deshalb sieht Metro sie nur mit
 * watchFolders – ohne die Einstellung schlage der Import beim Bundlen.
 */
config.watchFolders = [workspaceRoot];

/*
 * Aufloesung zuerst hier, dann in der Repo-Wurzel. Die geteilten Module
 * importieren keine Pakete, aber falls eines von ihnen je eines braucht,
 * gewinnt das App-Verzeichnis.
 */
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
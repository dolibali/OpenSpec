import { promises as fs } from 'fs';
import path from 'path';

import { readChangeMetadata, writeChangeMetadata } from '../utils/change-metadata.js';
import { DEFAULT_SDD_CONFIG, isValidSddPrefix, isValidSddRoot } from './config-schema.js';
import { getGlobalConfig } from './global-config.js';

export interface SddConfig {
  enabled: boolean;
  reqIdRequired: boolean;
  root: string;
  prefix: string;
}

export interface SddMetadata {
  req_id?: string;
  /** @deprecated Legacy metadata written by older fork versions. */
  jira?: string;
  directory: string;
  change: string;
}

export type SddSyncResult =
  | { status: 'synced'; targetDir: string }
  | { status: 'skipped'; reason: 'disabled' | 'missing-metadata' | 'missing-sdd' };

export interface SddDocsDirectoryResult {
  targetDir: string;
  metadata: SddMetadata;
}

const REQ_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const REQ_ID_INPUT_PATTERN = /^(?:jira(?:号)?|req(?:uirement)?|需求(?:号|id)?)(?:是|[:=])?\s*([A-Za-z0-9][A-Za-z0-9_-]*)$/i;

export function resolveSddConfig(): SddConfig {
  const rawSdd = getGlobalConfig().sdd ?? {};
  const root = typeof rawSdd.root === 'string' && isValidSddRoot(rawSdd.root)
    ? rawSdd.root
    : DEFAULT_SDD_CONFIG.root;
  const prefix = typeof rawSdd.prefix === 'string' && isValidSddPrefix(rawSdd.prefix)
    ? rawSdd.prefix
    : DEFAULT_SDD_CONFIG.prefix;

  return {
    enabled: typeof rawSdd.enabled === 'boolean' ? rawSdd.enabled : DEFAULT_SDD_CONFIG.enabled,
    reqIdRequired: typeof rawSdd.reqIdRequired === 'boolean'
      ? rawSdd.reqIdRequired
      : DEFAULT_SDD_CONFIG.reqIdRequired,
    root,
    prefix,
  };
}

export function isSddEnabled(): boolean {
  return resolveSddConfig().enabled;
}

export function isSddReqIdRequired(): boolean {
  const config = resolveSddConfig();
  return config.enabled && config.reqIdRequired;
}

export function parseReqIdInput(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new Error('Requirement id cannot be empty');
  }

  if (/^https?:\/\//i.test(trimmed) || /[\\/]/.test(trimmed)) {
    throw new Error('Requirement id must be provided as an id such as DSH-618, not a URL or path');
  }

  if (/^JIRA_/i.test(trimmed)) {
    throw new Error('Requirement id should not include the JIRA_ directory prefix');
  }

  const explicitMatch = trimmed.match(REQ_ID_INPUT_PATTERN);
  const reqId = explicitMatch?.[1] ?? trimmed;

  if (!REQ_ID_PATTERN.test(reqId)) {
    throw new Error('Requirement id must contain only letters, numbers, underscores, and hyphens');
  }

  return reqId;
}

/** @deprecated Use parseReqIdInput. */
export function parseJiraInput(input: string): string {
  return parseReqIdInput(input);
}

function getSddReqId(metadata: SddMetadata): string | undefined {
  return metadata.req_id ?? metadata.jira;
}

function buildSddDirectoryName(changeName: string, reqId: string | undefined, config: SddConfig): string {
  return [config.prefix, reqId, changeName]
    .filter((segment): segment is string => typeof segment === 'string' && segment.length > 0)
    .join('_');
}

export function buildSddMetadata(
  changeName: string,
  reqIdInput?: string,
  config = resolveSddConfig()
): SddMetadata {
  const reqId = reqIdInput ? parseReqIdInput(reqIdInput) : undefined;

  return {
    ...(reqId ? { req_id: reqId } : {}),
    directory: buildSddDirectoryName(changeName, reqId, config),
    change: changeName,
  };
}

function refreshSddMetadata(changeName: string, metadata: SddMetadata, config: SddConfig): SddMetadata {
  return buildSddMetadata(changeName, getSddReqId(metadata), config);
}

export function getSddRootDir(projectRoot: string, config = resolveSddConfig()): string {
  return path.join(projectRoot, config.root);
}

function getSddTargetDir(projectRoot: string, metadata: SddMetadata, config = resolveSddConfig()): string {
  return path.join(getSddRootDir(projectRoot, config), metadata.directory);
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function assertSameSddSource(
  targetDir: string,
  expected: SddMetadata,
  projectRoot: string
): Promise<void> {
  try {
    const targetMetadata = readChangeMetadata(targetDir, projectRoot);
    const targetSdd = targetMetadata?.sdd;

    if (
      targetSdd?.change === expected.change &&
      getSddReqId(targetSdd) === getSddReqId(expected) &&
      targetSdd.directory === expected.directory
    ) {
      return;
    }
  } catch {
    // Fall through to the uniform conflict error below.
  }

  throw new Error(
    `SDD mirror target already exists at ${targetDir} but does not belong to change ` +
      `'${expected.change}' with req id '${getSddReqId(expected) ?? '(omitted)'}'.`
  );
}

export async function createSddDocsDirectory(
  projectRoot: string,
  changeName: string,
  reqIdInput?: string,
  options: { omitReqId?: boolean } = {}
): Promise<SddDocsDirectoryResult> {
  const config = resolveSddConfig();
  if (!config.enabled) {
    throw new Error("Enterprise SDD output is disabled. Run 'openspec config set sdd.enabled true' to enable it.");
  }

  if (config.reqIdRequired && !reqIdInput && !options.omitReqId) {
    throw new Error(
      'Missing required option --req-id. Provide a requirement id such as DSH-618, ' +
        'use --omit-req-id to create a directory without one, or run ' +
        "'openspec config set sdd.reqIdRequired false'."
    );
  }

  const metadata = buildSddMetadata(changeName, reqIdInput, config);
  const targetDir = getSddTargetDir(projectRoot, metadata, config);

  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`SDD docs target exists but is not a directory: ${targetDir}`);
    }
    await assertSameSddSource(targetDir, metadata, projectRoot);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.mkdir(targetDir, { recursive: true });

  const today = new Date().toISOString().split('T')[0];
  writeChangeMetadata(
    targetDir,
    {
      schema: 'spec-driven',
      created: today,
      sdd: metadata,
    },
    projectRoot
  );

  return { targetDir, metadata };
}

export async function syncSddMirror(
  projectRoot: string,
  changeName: string,
  changesDir = path.join(projectRoot, 'openspec', 'changes')
): Promise<SddSyncResult> {
  const config = resolveSddConfig();
  if (!config.enabled) {
    return { status: 'skipped', reason: 'disabled' };
  }

  const changeDir = path.join(changesDir, changeName);
  const metadata = readChangeMetadata(changeDir, projectRoot);

  if (!metadata) {
    return { status: 'skipped', reason: 'missing-metadata' };
  }

  if (!metadata.sdd) {
    return { status: 'skipped', reason: 'missing-sdd' };
  }

  const sddMetadata = refreshSddMetadata(changeName, metadata.sdd, config);
  const targetDir = getSddTargetDir(projectRoot, sddMetadata, config);

  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`SDD mirror target exists but is not a directory: ${targetDir}`);
    }
    await assertSameSddSource(targetDir, sddMetadata, projectRoot);
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  writeChangeMetadata(changeDir, { ...metadata, sdd: sddMetadata }, projectRoot);
  await fs.mkdir(getSddRootDir(projectRoot, config), { recursive: true });
  await copyDirRecursive(changeDir, targetDir);

  return { status: 'synced', targetDir };
}

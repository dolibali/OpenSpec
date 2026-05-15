import { promises as fs } from 'fs';
import path from 'path';

import { readChangeMetadata } from '../utils/change-metadata.js';
import { readProjectConfig } from './project-config.js';

export interface SddMetadata {
  jira: string;
  directory: string;
  change: string;
}

export type SddSyncResult =
  | { status: 'synced'; targetDir: string }
  | { status: 'skipped'; reason: 'missing-metadata' | 'missing-sdd' };

const JIRA_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]+-\d+[A-Za-z0-9-]*$/;
const JIRA_INPUT_PATTERN = /^jira(?:号)?(?:是|[:=])?\s*([A-Za-z][A-Za-z0-9]+-\d+[A-Za-z0-9-]*)$/i;

export function isSddRequired(projectRoot: string): boolean {
  const config = readProjectConfig(projectRoot);
  return config?.sdd?.required ?? true;
}

export function parseJiraInput(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new Error('Jira key cannot be empty');
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('/')) {
    throw new Error('Jira key must be provided as a key such as DSH-618, not a URL or path');
  }

  if (trimmed.startsWith('JIRA_')) {
    throw new Error('Jira key should not include the JIRA_ directory prefix');
  }

  const explicitMatch = trimmed.match(JIRA_INPUT_PATTERN);
  const jira = explicitMatch?.[1] ?? trimmed;

  if (!JIRA_KEY_PATTERN.test(jira)) {
    throw new Error('Jira key must look like DSH-618');
  }

  return jira;
}

export function buildSddMetadata(changeName: string, jiraInput: string): SddMetadata {
  const jira = parseJiraInput(jiraInput);

  return {
    jira,
    directory: `JIRA_${jira}_${changeName}`,
    change: changeName,
  };
}

export function getSddRootDir(projectRoot: string): string {
  return path.join(projectRoot, 'specs');
}

function getSddTargetDir(projectRoot: string, metadata: SddMetadata): string {
  return path.join(getSddRootDir(projectRoot), metadata.directory);
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

    if (targetSdd?.change === expected.change && targetSdd.jira === expected.jira) {
      return;
    }
  } catch {
    // Fall through to the uniform conflict error below.
  }

  throw new Error(
    `SDD mirror target already exists at ${targetDir} but does not belong to change ` +
      `'${expected.change}' with Jira '${expected.jira}'.`
  );
}

export async function syncSddMirror(
  projectRoot: string,
  changeName: string,
  changesDir = path.join(projectRoot, 'openspec', 'changes')
): Promise<SddSyncResult> {
  const changeDir = path.join(changesDir, changeName);
  const metadata = readChangeMetadata(changeDir, projectRoot);

  if (!metadata) {
    return { status: 'skipped', reason: 'missing-metadata' };
  }

  if (!metadata.sdd) {
    return { status: 'skipped', reason: 'missing-sdd' };
  }

  const targetDir = getSddTargetDir(projectRoot, metadata.sdd);

  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`SDD mirror target exists but is not a directory: ${targetDir}`);
    }
    await assertSameSddSource(targetDir, metadata.sdd, projectRoot);
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.mkdir(getSddRootDir(projectRoot), { recursive: true });
  await copyDirRecursive(changeDir, targetDir);

  return { status: 'synced', targetDir };
}

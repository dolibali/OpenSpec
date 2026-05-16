import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import {
  buildSddMetadata,
  createSddDocsDirectory,
  parseJiraInput,
  syncSddMirror,
} from '../../src/core/sdd.js';
import { writeChangeMetadata } from '../../src/utils/change-metadata.js';

describe('enterprise SDD mirror', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sdd-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('parses supported Jira input forms without changing case', () => {
    expect(parseJiraInput('DSH-618')).toBe('DSH-618');
    expect(parseJiraInput('jira号是dsh-618')).toBe('dsh-618');
    expect(parseJiraInput('jira:ABC-123')).toBe('ABC-123');
    expect(parseJiraInput('jira=ABC-123')).toBe('ABC-123');
    expect(parseJiraInput('jiraABC-123')).toBe('ABC-123');
  });

  it('rejects Jira URLs and directory prefixes', () => {
    expect(() => parseJiraInput('https://jira.example.com/browse/DSH-618')).toThrow(/not a URL/);
    expect(() => parseJiraInput('JIRA_DSH-618')).toThrow(/JIRA_/);
  });

  it('syncs and updates the full change directory mirror', async () => {
    const changeName = 'add-login-code';
    const changesDir = path.join(tempDir, 'openspec', 'changes');
    const changeDir = path.join(changesDir, changeName);
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal\n');

    writeChangeMetadata(
      changeDir,
      {
        schema: 'spec-driven',
        sdd: buildSddMetadata(changeName, 'DSH-618'),
      },
      tempDir
    );

    const first = await syncSddMirror(tempDir, changeName);
    expect(first.status).toBe('synced');

    const mirrorDir = path.join(tempDir, 'specs', 'JIRA_DSH-618_add-login-code');
    expect(await fs.readFile(path.join(mirrorDir, 'proposal.md'), 'utf-8')).toBe('# Proposal\n');

    await fs.writeFile(path.join(changeDir, 'design.md'), '# Design\n');
    const second = await syncSddMirror(tempDir, changeName, changesDir);
    expect(second.status).toBe('synced');
    expect(await fs.readFile(path.join(mirrorDir, 'design.md'), 'utf-8')).toBe('# Design\n');
  });

  it('blocks syncing over a mirror owned by another change', async () => {
    const changeName = 'add-login-code';
    const changesDir = path.join(tempDir, 'openspec', 'changes');
    const changeDir = path.join(changesDir, changeName);
    const mirrorDir = path.join(tempDir, 'specs', 'JIRA_DSH-618_add-login-code');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.mkdir(mirrorDir, { recursive: true });

    writeChangeMetadata(
      changeDir,
      {
        schema: 'spec-driven',
        sdd: buildSddMetadata(changeName, 'DSH-618'),
      },
      tempDir
    );
    writeChangeMetadata(
      mirrorDir,
      {
        schema: 'spec-driven',
        sdd: buildSddMetadata('other-change', 'DSH-618'),
      },
      tempDir
    );

    await expect(syncSddMirror(tempDir, changeName, changesDir)).rejects.toThrow(
      /does not belong/
    );
  });

  it('creates a standard SDD docs directory with regular metadata', async () => {
    const result = await createSddDocsDirectory(tempDir, 'fix-login-code-error', 'DSH-618');
    const metadataPath = path.join(result.targetDir, '.openspec.yaml');
    const metadata = await fs.readFile(metadataPath, 'utf-8');

    expect(result.targetDir).toBe(path.join(tempDir, 'specs', 'JIRA_DSH-618_fix-login-code-error'));
    expect(metadata).toContain('schema: spec-driven');
    expect(metadata).toContain('jira: DSH-618');
    expect(metadata).toContain('directory: JIRA_DSH-618_fix-login-code-error');
    expect(metadata).toContain('change: fix-login-code-error');
    expect(metadata).not.toContain('docs-only');
    expect(metadata).not.toContain('generated_from');
  });

  it('allows updating an existing SDD docs directory only for the same source', async () => {
    const first = await createSddDocsDirectory(tempDir, 'fix-login-code-error', 'DSH-618');
    await fs.writeFile(path.join(first.targetDir, 'tasks.md'), '- [x] Existing task\n');

    const second = await createSddDocsDirectory(tempDir, 'fix-login-code-error', 'DSH-618');
    expect(second.targetDir).toBe(first.targetDir);
    expect(await fs.readFile(path.join(second.targetDir, 'tasks.md'), 'utf-8')).toBe(
      '- [x] Existing task\n'
    );

    const conflictingDir = path.join(tempDir, 'specs', 'JIRA_DSH-620_fix-login-code-error');
    await fs.mkdir(conflictingDir, { recursive: true });
    writeChangeMetadata(
      conflictingDir,
      {
        schema: 'spec-driven',
        sdd: buildSddMetadata('other-change', 'DSH-620'),
      },
      tempDir
    );
    await expect(createSddDocsDirectory(tempDir, 'fix-login-code-error', 'DSH-620')).rejects.toThrow(
      /does not belong/
    );
  });
});

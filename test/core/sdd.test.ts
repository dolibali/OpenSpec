import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import {
  buildSddMetadata,
  createSddDocsDirectory,
  parseJiraInput,
  parseReqIdInput,
  syncSddMirror,
} from '../../src/core/sdd.js';
import { saveGlobalConfig } from '../../src/core/global-config.js';
import { writeChangeMetadata } from '../../src/utils/change-metadata.js';

describe('enterprise SDD mirror', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sdd-'));
    process.env.XDG_CONFIG_HOME = path.join(tempDir, 'config');
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('parses supported req id input forms without changing case', () => {
    expect(parseReqIdInput('DSH-618')).toBe('DSH-618');
    expect(parseReqIdInput('req:ABC-123')).toBe('ABC-123');
    expect(parseReqIdInput('req=ABC-123')).toBe('ABC-123');
    expect(parseReqIdInput('需求号是REQ-1001')).toBe('REQ-1001');
    expect(parseReqIdInput('需求ID是dsh-618')).toBe('dsh-618');
    expect(parseReqIdInput('jira号是dsh-618')).toBe('dsh-618');
    expect(parseJiraInput('jiraABC-123')).toBe('ABC-123');
  });

  it('rejects req id URLs and directory prefixes', () => {
    expect(() => parseReqIdInput('https://jira.example.com/browse/DSH-618')).toThrow(/not a URL/);
    expect(() => parseReqIdInput('JIRA_DSH-618')).toThrow(/JIRA_/);
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
    const mirroredMetadata = await fs.readFile(path.join(mirrorDir, '.openspec.yaml'), 'utf-8');
    expect(mirroredMetadata).toContain('req_id: DSH-618');
    expect(mirroredMetadata).not.toContain('jira: DSH-618');

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
    expect(metadata).toContain('req_id: DSH-618');
    expect(metadata).toContain('directory: JIRA_DSH-618_fix-login-code-error');
    expect(metadata).toContain('change: fix-login-code-error');
    expect(metadata).not.toContain('jira: DSH-618');
    expect(metadata).not.toContain('docs-only');
    expect(metadata).not.toContain('generated_from');
  });

  it('uses global SDD root and prefix settings', async () => {
    saveGlobalConfig({
      sdd: {
        enabled: true,
        reqIdRequired: true,
        root: 'specs/archive',
        prefix: 'REQ',
      },
    });

    const result = await createSddDocsDirectory(tempDir, 'fix-login-code-error', 'DSH-618');

    expect(result.targetDir).toBe(
      path.join(tempDir, 'specs', 'archive', 'REQ_DSH-618_fix-login-code-error')
    );
  });

  it('omits empty directory name segments', async () => {
    saveGlobalConfig({
      sdd: {
        enabled: true,
        reqIdRequired: true,
        root: 'specs',
        prefix: '',
      },
    });

    const withReqId = await createSddDocsDirectory(tempDir, 'fix-login-code-error', 'DSH-618');
    expect(withReqId.targetDir).toBe(path.join(tempDir, 'specs', 'DSH-618_fix-login-code-error'));

    const withoutReqId = await createSddDocsDirectory(
      tempDir,
      'no-req-id-change',
      undefined,
      { omitReqId: true }
    );
    expect(withoutReqId.targetDir).toBe(path.join(tempDir, 'specs', 'no-req-id-change'));
  });

  it('creates a directory without req id when req id is not required', async () => {
    saveGlobalConfig({
      sdd: {
        enabled: true,
        reqIdRequired: false,
        root: 'specs',
        prefix: 'JIRA',
      },
    });

    const result = await createSddDocsDirectory(tempDir, 'fix-login-code-error');

    expect(result.targetDir).toBe(path.join(tempDir, 'specs', 'JIRA_fix-login-code-error'));
    const metadata = await fs.readFile(path.join(result.targetDir, '.openspec.yaml'), 'utf-8');
    expect(metadata).not.toContain('req_id:');
  });

  it('skips sync and blocks docs when enterprise SDD output is disabled', async () => {
    saveGlobalConfig({
      sdd: {
        enabled: false,
        reqIdRequired: true,
        root: 'specs',
        prefix: 'JIRA',
      },
    });

    await expect(createSddDocsDirectory(tempDir, 'fix-login-code-error', 'DSH-618')).rejects.toThrow(
      /disabled/
    );
    await expect(syncSddMirror(tempDir, 'missing-change')).resolves.toEqual({
      status: 'skipped',
      reason: 'disabled',
    });
  });

  it('syncs legacy Jira metadata as req id metadata', async () => {
    const changeName = 'legacy-jira-change';
    const changesDir = path.join(tempDir, 'openspec', 'changes');
    const changeDir = path.join(changesDir, changeName);
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal\n');
    await fs.writeFile(
      path.join(changeDir, '.openspec.yaml'),
      `schema: spec-driven
sdd:
  jira: DSH-618
  directory: JIRA_DSH-618_legacy-jira-change
  change: legacy-jira-change
`,
      'utf-8'
    );

    const result = await syncSddMirror(tempDir, changeName, changesDir);

    expect(result.status).toBe('synced');
    const mirrorMetadata = await fs.readFile(
      path.join(tempDir, 'specs', 'JIRA_DSH-618_legacy-jira-change', '.openspec.yaml'),
      'utf-8'
    );
    expect(mirrorMetadata).toContain('req_id: DSH-618');
    expect(mirrorMetadata).not.toContain('jira: DSH-618');
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

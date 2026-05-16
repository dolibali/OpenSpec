import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  type SkillTemplate,
  getApplyChangeSkillTemplate,
  getArchiveChangeSkillTemplate,
  getBulkArchiveChangeSkillTemplate,
  getContinueChangeSkillTemplate,
  getExploreSkillTemplate,
  getFeedbackSkillTemplate,
  getFfChangeSkillTemplate,
  getNewChangeSkillTemplate,
  getOnboardSkillTemplate,
  getOpsxApplyCommandTemplate,
  getOpsxArchiveCommandTemplate,
  getOpsxBulkArchiveCommandTemplate,
  getOpsxContinueCommandTemplate,
  getOpsxExploreCommandTemplate,
  getOpsxFfCommandTemplate,
  getOpsxNewCommandTemplate,
  getOpsxOnboardCommandTemplate,
  getOpsxSyncCommandTemplate,
  getOpsxProposeCommandTemplate,
  getOpsxProposeSkillTemplate,
  getOpsxSddDocsCommandTemplate,
  getOpsxVerifyCommandTemplate,
  getSddDocsSkillTemplate,
  getSyncSpecsSkillTemplate,
  getVerifyChangeSkillTemplate,
} from '../../../src/core/templates/skill-templates.js';
import { generateSkillContent } from '../../../src/core/shared/skill-generation.js';

const EXPECTED_FUNCTION_HASHES: Record<string, string> = {
  getExploreSkillTemplate: 'e2765fae6c2e960f4ce07058cfdaa547ff3435d454eacd5e924e38139e97ad52',
  getNewChangeSkillTemplate: '978d28b842cf0984e21ae3993d198b3851044c40b76740ca9133976fb2321de1',
  getContinueChangeSkillTemplate: '5e171957206dafe464613d21fc16d78a95ea98e6143896c6e3109302030bde00',
  getApplyChangeSkillTemplate: '1cb9dd81a70af5c3af96d48e289b69f70bd1c075314f163dcc5d8f288df96b0c',
  getFfChangeSkillTemplate: 'f10750fe3d80b30b06ba03b1fb2384f7a6dd26c620270602f796b74f2254608c',
  getSyncSpecsSkillTemplate: '9f02b41227db70875b89eefeb275c769142607dc5b2593f4e606794aed2fdbad',
  getOnboardSkillTemplate: 'c8e9699640ea973e620ff8c35e4be595c5425b7d6e9c3826e599de5e20c16958',
  getOpsxExploreCommandTemplate: '4d5e64e3ede6703113cf2fd23b797371ef2407b702478b4f7240fc81cbf2d3a5',
  getOpsxNewCommandTemplate: '184f589fe5077d572537bece0d50e44bcc91a0f6716758e04e8219bc9566aaee',
  getOpsxContinueCommandTemplate: '357c5f5342d1f5356dfe377ff07c6294746642a196091830b16db23fa77f75cb',
  getOpsxApplyCommandTemplate: 'af8696de7aeb12cf0304e4abce49750b58887a8bbf3bc19a9aa2d49267a12b1f',
  getOpsxFfCommandTemplate: 'f26c4cadb4f980aa840de47f2da046dffe448fa65518be82f5f6cc2d54874405',
  getArchiveChangeSkillTemplate: '78d6bfd98092e19f2fcfbb5a368b8984612bbc0bde3d12c4006906bbe7ef04b4',
  getBulkArchiveChangeSkillTemplate: '0a945fe340baba912623964832e201c70cf11b7ce6486d8ec07142aa7ed91b53',
  getOpsxSyncCommandTemplate: '4c8118afaea79ff4fed3d946c88e6a7abbba904a5fbf643e4372da1e3735a467',
  getVerifyChangeSkillTemplate: '3c5dda8b49ba00f50b5bae7f04763dd00cc00a05e5f1d8a2068ad7fb701d8165',
  getOpsxArchiveCommandTemplate: '9930006bfbc43e280b71465093c384b1cea4caa075a9103913eaac9accd5f972',
  getOpsxOnboardCommandTemplate: '7d4167b42e757494608431244d6e926a667b65c97f82bef6d7ba9a1fe03bf3c7',
  getOpsxBulkArchiveCommandTemplate: '07a7d44440059dc287e749dacb9e2b61d072a3e55f2168c6d87132376bba86a7',
  getOpsxVerifyCommandTemplate: '9a7a3f9e5bc3d0c0878b1a4493efbbb38729597d9b9be78f63284cc2da7c20c3',
  getOpsxProposeSkillTemplate: '83b51ae6fa1efb8d268f12b34b70cb21f790af21610c5fe33cc018009d8c2c7a',
  getOpsxProposeCommandTemplate: 'fd20527dbc2c6e7c06dd2993097f83885d78ce35b8861f10d62dd50a7dd7b0d7',
  getSddDocsSkillTemplate: 'bdc34b58b717d3b5c547c1e00855f24880aebe09a09b7e0e8941a1ef3a318730',
  getOpsxSddDocsCommandTemplate: '35e1435f4e904043ba82ceee358ad7cd9c3a1b6cb6da876a59e122297165802f',
  getFeedbackSkillTemplate: 'd7d83c5f7fc2b92fe8f4588a5bf2d9cb315e4c73ec19bcd5ef28270906319a0d',
};

const EXPECTED_GENERATED_SKILL_CONTENT_HASHES: Record<string, string> = {
  'openspec-explore': '28d900ef82b325beb65e69ee6435949adcfdf14a4314638e7006e6dc359b92d4',
  'openspec-new-change': '264dca5e38ab4ce05f233cc9afae5346ac9cf35a78b420b0c336822d68696a88',
  'openspec-continue-change': '6e839d202e8fcc4ee848a84f9149ec3183ac6da46c88a1d65fdf5644d698c47d',
  'openspec-apply-change': '46f1dfaab55bd19d3a3a0676a98d28b5de9dbd819997543e0d59ea69a1333ca0',
  'openspec-ff-change': '021424db8c1524f30df72b521f1e5aed55f91f1034be2bd7d232e6dc532c95ea',
  'openspec-sync-specs': '2e0f67ec6fadffc6107b4b1a28eef23a99a6649e5fae706897ea1dd9deb852a8',
  'openspec-archive-change': 'e2cd6b579d2bd3e008c435e53fb11cf8de0763d6be5e9f4921753e9fcdb470b9',
  'openspec-bulk-archive-change': 'f76811a09b935c2f0f061fac5a7f065520e54e4f7a8fdbb4d13ccb092490c1fb',
  'openspec-verify-change': 'a2acecd0c2b4e57080a314e5e7a093e0688293c37e446eb45d378f5050058550',
  'openspec-onboard': '65f55256e0108bfb91b412abf895cec038c9413712e43edf1bf98977dd010ad9',
  'openspec-propose': '90558bb078c88516b8039974da196f4901bd4554660dcb0c570121f9d8b1260c',
  'openspec-sdd-docs': '600513262da37325aed88b45a57e05fe662abe0f5e23b3722998cc6e63d3e37c',
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('skill templates split parity', () => {
  it('preserves all template function payloads exactly', () => {
    const functionFactories: Record<string, () => unknown> = {
      getExploreSkillTemplate,
      getNewChangeSkillTemplate,
      getContinueChangeSkillTemplate,
      getApplyChangeSkillTemplate,
      getFfChangeSkillTemplate,
      getSyncSpecsSkillTemplate,
      getOnboardSkillTemplate,
      getOpsxExploreCommandTemplate,
      getOpsxNewCommandTemplate,
      getOpsxContinueCommandTemplate,
      getOpsxApplyCommandTemplate,
      getOpsxFfCommandTemplate,
      getArchiveChangeSkillTemplate,
      getBulkArchiveChangeSkillTemplate,
      getOpsxSyncCommandTemplate,
      getVerifyChangeSkillTemplate,
      getOpsxArchiveCommandTemplate,
      getOpsxOnboardCommandTemplate,
      getOpsxBulkArchiveCommandTemplate,
      getOpsxVerifyCommandTemplate,
      getOpsxProposeSkillTemplate,
      getOpsxProposeCommandTemplate,
      getSddDocsSkillTemplate,
      getOpsxSddDocsCommandTemplate,
      getFeedbackSkillTemplate,
    };

    const actualHashes = Object.fromEntries(
      Object.entries(functionFactories).map(([name, fn]) => [name, hash(stableStringify(fn()))])
    );

    expect(actualHashes).toEqual(EXPECTED_FUNCTION_HASHES);
  });

  it('preserves generated skill file content exactly', () => {
    // Intentionally excludes getFeedbackSkillTemplate: skillFactories only models templates
    // deployed via generateSkillContent, while feedback is covered in function payload parity.
    const skillFactories: Array<[string, () => SkillTemplate]> = [
      ['openspec-explore', getExploreSkillTemplate],
      ['openspec-new-change', getNewChangeSkillTemplate],
      ['openspec-continue-change', getContinueChangeSkillTemplate],
      ['openspec-apply-change', getApplyChangeSkillTemplate],
      ['openspec-ff-change', getFfChangeSkillTemplate],
      ['openspec-sync-specs', getSyncSpecsSkillTemplate],
      ['openspec-archive-change', getArchiveChangeSkillTemplate],
      ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate],
      ['openspec-verify-change', getVerifyChangeSkillTemplate],
      ['openspec-onboard', getOnboardSkillTemplate],
      ['openspec-propose', getOpsxProposeSkillTemplate],
      ['openspec-sdd-docs', getSddDocsSkillTemplate],
    ];

    const actualHashes = Object.fromEntries(
      skillFactories.map(([dirName, createTemplate]) => [
        dirName,
        hash(generateSkillContent(createTemplate(), 'PARITY-BASELINE')),
      ])
    );

    expect(actualHashes).toEqual(EXPECTED_GENERATED_SKILL_CONTENT_HASHES);
  });

  it('guards unsupported workspace workflows from repo-local fallback edits', () => {
    const guardedSkills: Array<[string, () => SkillTemplate, string]> = [
      ['openspec-apply-change', getApplyChangeSkillTemplate, 'full workspace apply is not supported'],
      ['openspec-sync-specs', getSyncSpecsSkillTemplate, 'workspace spec sync is not supported'],
      ['openspec-archive-change', getArchiveChangeSkillTemplate, 'workspace archive is not supported'],
      ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate, 'workspace bulk archive is not supported'],
      ['openspec-verify-change', getVerifyChangeSkillTemplate, 'full workspace implementation verification is not supported'],
    ];

    for (const [dirName, createTemplate, guardText] of guardedSkills) {
      const content = generateSkillContent(createTemplate(), 'PARITY-BASELINE');

      expect(content, dirName).toContain('actionContext.mode: "workspace-planning"');
      expect(content, dirName).toContain(guardText);
      expect(content, dirName).not.toContain('openspec/changes/<name>');
      expect(content, dirName).not.toContain('mv openspec/changes');
    }
  });
});

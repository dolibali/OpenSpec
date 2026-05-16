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
  getNewChangeSkillTemplate: '3c434c42083250cf5e1ff40c3ff52f5296727f69abfb064625b5544ae5f20a6a',
  getContinueChangeSkillTemplate: '5e171957206dafe464613d21fc16d78a95ea98e6143896c6e3109302030bde00',
  getApplyChangeSkillTemplate: '1cb9dd81a70af5c3af96d48e289b69f70bd1c075314f163dcc5d8f288df96b0c',
  getFfChangeSkillTemplate: '20c6754975e424628b0d4934a51d06db3341f38e04eeee19fa73b704a894f6ff',
  getSyncSpecsSkillTemplate: '9f02b41227db70875b89eefeb275c769142607dc5b2593f4e606794aed2fdbad',
  getOnboardSkillTemplate: 'f596450501e97be88b4167aa404123635baa5c1d22d975f2dbc0a1276820783f',
  getOpsxExploreCommandTemplate: '4d5e64e3ede6703113cf2fd23b797371ef2407b702478b4f7240fc81cbf2d3a5',
  getOpsxNewCommandTemplate: 'acdcb06dbc4593cbe91ab6306431759bb211c299b1b98839db0decfebaaa442b',
  getOpsxContinueCommandTemplate: '357c5f5342d1f5356dfe377ff07c6294746642a196091830b16db23fa77f75cb',
  getOpsxApplyCommandTemplate: 'af8696de7aeb12cf0304e4abce49750b58887a8bbf3bc19a9aa2d49267a12b1f',
  getOpsxFfCommandTemplate: '5ad07f5561d735cdc3124e29639714e5bcce7ef7cc61d91bd3235b120668dc09',
  getArchiveChangeSkillTemplate: '78d6bfd98092e19f2fcfbb5a368b8984612bbc0bde3d12c4006906bbe7ef04b4',
  getBulkArchiveChangeSkillTemplate: '0a945fe340baba912623964832e201c70cf11b7ce6486d8ec07142aa7ed91b53',
  getOpsxSyncCommandTemplate: '4c8118afaea79ff4fed3d946c88e6a7abbba904a5fbf643e4372da1e3735a467',
  getVerifyChangeSkillTemplate: '3c5dda8b49ba00f50b5bae7f04763dd00cc00a05e5f1d8a2068ad7fb701d8165',
  getOpsxArchiveCommandTemplate: '9930006bfbc43e280b71465093c384b1cea4caa075a9103913eaac9accd5f972',
  getOpsxOnboardCommandTemplate: 'feaf078b6c5bc720ef35a06d889195075eb72213fdddc8731d150431e1fd0a7e',
  getOpsxBulkArchiveCommandTemplate: '07a7d44440059dc287e749dacb9e2b61d072a3e55f2168c6d87132376bba86a7',
  getOpsxVerifyCommandTemplate: '9a7a3f9e5bc3d0c0878b1a4493efbbb38729597d9b9be78f63284cc2da7c20c3',
  getOpsxProposeSkillTemplate: '1448b71c303efe30dad666b97db922a909477705176dc5d71b6ef9f1a8f667b4',
  getOpsxProposeCommandTemplate: '63ca8146c8c9d7bedf641f87897e559d039cf6404d12e82599224c48153861eb',
  getSddDocsSkillTemplate: '9137e27c270aef230a14dacf6800d9ff5c8be5974d50aefc0ff2c35c1e8e8e8d',
  getOpsxSddDocsCommandTemplate: '4e7b7881f9d4d71a112e23d7110dfd4583a5371c09ea87ffc73b7fbc2b7bfbb2',
  getFeedbackSkillTemplate: 'd7d83c5f7fc2b92fe8f4588a5bf2d9cb315e4c73ec19bcd5ef28270906319a0d',
};

const EXPECTED_GENERATED_SKILL_CONTENT_HASHES: Record<string, string> = {
  'openspec-explore': '28d900ef82b325beb65e69ee6435949adcfdf14a4314638e7006e6dc359b92d4',
  'openspec-new-change': '1663689ebe57e6e4677b40716d4c501a8b60d9586b7a8fcf10a6b1ea010e98c3',
  'openspec-continue-change': '6e839d202e8fcc4ee848a84f9149ec3183ac6da46c88a1d65fdf5644d698c47d',
  'openspec-apply-change': '46f1dfaab55bd19d3a3a0676a98d28b5de9dbd819997543e0d59ea69a1333ca0',
  'openspec-ff-change': '78b2e9a6623c1245009c058497b802aa591fa4b14bb0c5a07a760e0970152175',
  'openspec-sync-specs': '2e0f67ec6fadffc6107b4b1a28eef23a99a6649e5fae706897ea1dd9deb852a8',
  'openspec-archive-change': 'e2cd6b579d2bd3e008c435e53fb11cf8de0763d6be5e9f4921753e9fcdb470b9',
  'openspec-bulk-archive-change': 'f76811a09b935c2f0f061fac5a7f065520e54e4f7a8fdbb4d13ccb092490c1fb',
  'openspec-verify-change': 'a2acecd0c2b4e57080a314e5e7a093e0688293c37e446eb45d378f5050058550',
  'openspec-onboard': 'a593336fde8f8c271368ece9ca9f24cdec4a8f20dc40add98470b39bf3ae71f4',
  'openspec-propose': 'a07f4b1afca6c40611c27d07b75cabf46779a85f16fe426d9477103e36e1ad19',
  'openspec-sdd-docs': '2e71f3df1dafcc2f35e0c81e827c0488dc5e91f55a8bc20fa0a284274e12a48e',
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

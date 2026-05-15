/**
 * New Change Command
 *
 * Creates a new change directory with optional description and schema.
 */

import ora from 'ora';
import path from 'path';
import { createChange, validateChangeName } from '../../utils/change-utils.js';
import {
  formatChangeLocation,
  resolveCurrentPlanningHomeSync,
  type PlanningHome,
} from '../../core/planning-home.js';
import { validateSchemaExists } from './shared.js';
import { buildSddMetadata, isSddRequired, syncSddMirror } from '../../core/sdd.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NewChangeOptions {
  description?: string;
  goal?: string;
  areas?: string;
  schema?: string;
  jira?: string;
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

function parseAffectedAreas(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((area) => area.trim())
    .filter((area) => area.length > 0);
}

function validateWorkspaceAffectedAreas(planningHome: PlanningHome, affectedAreas: string[]): void {
  if (affectedAreas.length === 0) {
    return;
  }

  if (planningHome.kind !== 'workspace') {
    throw new Error('--areas can only be used when creating a workspace-scoped change');
  }

  const validAreas = new Set(planningHome.workspace?.links ?? []);
  const invalidAreas = affectedAreas.filter((area) => !validAreas.has(area));

  if (invalidAreas.length > 0) {
    const validList = [...validAreas].sort((a, b) => a.localeCompare(b));
    const validMessage = validList.length > 0 ? validList.join(', ') : '(no registered links)';
    throw new Error(
      `Invalid affected area${invalidAreas.length === 1 ? '' : 's'}: ${invalidAreas.join(', ')}. ` +
        `Valid workspace link names: ${validMessage}`
    );
  }
}

export async function newChangeCommand(name: string | undefined, options: NewChangeOptions): Promise<void> {
  if (!name) {
    throw new Error('Missing required argument <name>');
  }

  const validation = validateChangeName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const planningHome = resolveCurrentPlanningHomeSync();
  const projectRoot = planningHome.root;
  const affectedAreas = parseAffectedAreas(options.areas);
  validateWorkspaceAffectedAreas(planningHome, affectedAreas);
  const sddRequired = isSddRequired(projectRoot);
  const sddMetadata = options.jira ? buildSddMetadata(name, options.jira) : undefined;

  if (sddRequired && !sddMetadata) {
    throw new Error("Missing required option --jira. Provide a Jira key such as DSH-618, or set 'sdd.required: false' in openspec/config.yaml.");
  }

  // Validate schema if provided
  if (options.schema) {
    validateSchemaExists(options.schema, projectRoot);
  }

  const resolvedSchema = options.schema ?? planningHome.defaultSchema;
  const schemaDisplay = ` with schema '${resolvedSchema}'`;
  const spinner = ora(`Creating change '${name}'${schemaDisplay}...`).start();

  try {
    const workspaceGoal = planningHome.kind === 'workspace'
      ? options.goal ?? options.description
      : options.goal;
    const result = await createChange(projectRoot, name, {
      schema: options.schema,
      defaultSchema: planningHome.defaultSchema,
      changesDir: planningHome.changesDir,
      metadata: {
        ...(workspaceGoal ? { goal: workspaceGoal } : {}),
        ...(affectedAreas.length > 0 ? { affected_areas: affectedAreas } : {}),
        ...(sddMetadata ? { sdd: sddMetadata } : {}),
      },
    });

    // If description provided, create README.md with description
    if (options.description) {
      const { promises: fs } = await import('fs');
      const readmePath = path.join(result.changeDir, 'README.md');
      await fs.writeFile(readmePath, `# ${name}\n\n${options.description}\n`, 'utf-8');
    }

    const location = formatChangeLocation(planningHome, name);
    const scope = planningHome.kind === 'workspace' ? 'workspace change' : 'change';
    spinner.succeed(`Created ${scope} '${name}' at ${location}/ (schema: ${result.schema})`);

    if (sddMetadata) {
      const syncResult = await syncSddMirror(projectRoot, name, planningHome.changesDir);
      if (syncResult.status === 'synced') {
        console.log(`SDD mirror: ${path.relative(projectRoot, syncResult.targetDir)}`);
      }
    }

    if (planningHome.kind === 'workspace') {
      if (affectedAreas.length > 0) {
        console.log(`Affected areas: ${affectedAreas.join(', ')}`);
      } else {
        console.log('Affected areas: unresolved; identify them in workspace specs or tasks as planning continues.');
      }
      console.log('Next: run openspec status --change "' + name + '" to inspect workspace planning artifacts.');
    }
  } catch (error) {
    spinner.fail(`Failed to create change '${name}'`);
    throw error;
  }
}

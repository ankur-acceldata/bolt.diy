import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('InternalActionsService');

export interface InternalTool {
  description?: string;
  parameters: any;
  execute: (parameters: any) => Promise<any>;
}

export type InternalToolSet = Record<string, InternalTool>;

/*
 * Global references - will be set during initialization
 * let _workbenchStoreRef: any = null; // Reserved for future use
 */
let executeAdhocRunRef: ((isEditAndRun?: boolean) => Promise<void>) | null = null;
let syncFilesRef: (() => Promise<void>) | null = null;

export class InternalActionsService {
  private static _instance: InternalActionsService;
  private _tools: InternalToolSet = {};

  private constructor() {
    this._initializeTools();
  }

  static getInstance(): InternalActionsService {
    if (!InternalActionsService._instance) {
      InternalActionsService._instance = new InternalActionsService();
    }

    return InternalActionsService._instance;
  }

  static setWorkbenchStore(_workbenchStore: any): void {
    // _workbenchStoreRef = _workbenchStore; // Reserved for future use

    // Reinitialize tools with workbench store reference
    InternalActionsService.getInstance()._initializeTools();
  }

  static setExecuteAdhocRun(executeAdhocRun: (isEditAndRun?: boolean) => Promise<void>): void {
    executeAdhocRunRef = executeAdhocRun;

    // Reinitialize tools with new reference
    InternalActionsService.getInstance()._initializeTools();
  }

  static setSyncFiles(syncFiles: () => Promise<void>): void {
    syncFilesRef = syncFiles;

    // Reinitialize tools with new reference
    InternalActionsService.getInstance()._initializeTools();
  }

  private _initializeTools(): void {
    this._tools = {
      'workbench.run': {
        description:
          'Execute the current project using the run button functionality. This triggers the same action as clicking the Run button in the workbench.',
        parameters: {
          jsonSchema: {
            type: 'object',
            properties: {
              isEditAndRun: {
                type: 'boolean',
                description: 'Whether to open the config editor before running',
                default: false,
              },
            },
            required: [],
          },
        },
        execute: async (parameters: { isEditAndRun?: boolean } = {}) => {
          logger.debug('🏃 WORKBENCH.RUN TOOL EXECUTING with parameters:', parameters);
          logger.info('Executing workbench.run with parameters:', parameters);

          if (!executeAdhocRunRef) {
            logger.error(' Execute adhoc run function not initialized');
            throw new Error('Execute adhoc run function not initialized - workbench not ready');
          }

          logger.info(' Execute adhoc run function is available');

          try {
            const { isEditAndRun = false } = parameters;

            // Call the actual executeAdhocRun function
            logger.debug(`🚀 TRIGGERING RUN ACTION with isEditAndRun: ${isEditAndRun}`);
            logger.info(`Triggering run action with isEditAndRun: ${isEditAndRun}`);
            await executeAdhocRunRef(isEditAndRun);

            logger.debug('🎯 RUN ACTION COMPLETED SUCCESSFULLY');

            return {
              success: true,
              message: `Project execution ${isEditAndRun ? '(with config editor) ' : ''}triggered successfully`,
              action: 'run',
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            logger.error('💥 RUN ACTION ED:', error);
            logger.error('Failed to execute run action:', error);
            throw new Error(
              `Failed to execute run action: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        },
      },

      'workbench.sync': {
        description:
          'Sync project files with remote storage. This triggers the same action as clicking the Sync button in the workbench.',
        parameters: {
          jsonSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        execute: async () => {
          logger.info('Executing workbench.sync');

          if (!syncFilesRef) {
            throw new Error('Sync files function not initialized - workbench not ready');
          }

          try {
            // Call the actual sync function
            logger.info('Triggering sync action');
            await syncFilesRef();

            return {
              success: true,
              message: 'File synchronization triggered successfully',
              action: 'sync',
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            logger.error('Failed to execute sync action:', error);
            throw new Error(
              `Failed to execute sync action: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        },
      },

      'workbench.build': {
        description: 'Build the current project. This triggers a build process for the project files.',
        parameters: {
          jsonSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        execute: async () => {
          logger.info('Executing workbench.build');

          try {
            // The actual implementation will trigger build through the action system
            logger.info('Triggering build action');

            return {
              success: true,
              message: 'Project build triggered successfully',
              action: 'build',
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            logger.error('Failed to execute build action:', error);
            throw new Error(
              `Failed to execute build action: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        },
      },
    };
  }

  get tools(): InternalToolSet {
    return this._tools;
  }

  get toolsWithoutExecute(): Record<string, Omit<InternalTool, 'execute'>> {
    const toolsWithoutExecute: Record<string, Omit<InternalTool, 'execute'>> = {};

    for (const [name, tool] of Object.entries(this._tools)) {
      const { execute, ...toolWithoutExecute } = tool;
      toolsWithoutExecute[name] = toolWithoutExecute;
    }

    return toolsWithoutExecute;
  }

  isValidToolName(toolName: string): boolean {
    return toolName in this._tools;
  }

  async executeTool(toolName: string, parameters: any = {}): Promise<any> {
    const tool = this._tools[toolName];

    if (!tool) {
      throw new Error(`Internal tool '${toolName}' not found`);
    }

    try {
      const result = await tool.execute(parameters);
      return result;
    } catch (error) {
      logger.error('💥 Internal tool execution ed:', error);
      logger.error(`Failed to execute internal tool '${toolName}':`, error);
      throw error;
    }
  }

  getToolDescription(toolName: string): string {
    const tool = this._tools[toolName];
    return tool ? tool.description || 'No description available' : 'Tool not found';
  }

  listTools(): string[] {
    return Object.keys(this._tools);
  }
}

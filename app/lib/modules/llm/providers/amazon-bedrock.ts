import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AmazonBedrock');

interface AWSBedRockConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export default class AmazonBedrockProvider extends BaseProvider {
  name = 'AmazonBedrock';
  getApiKeyLink = 'https://console.aws.amazon.com/iam/home';

  config = {
    apiTokenKey: 'AMAZON_BEDROCK_API_KEY',
  };

  // No static models - only show models fetched dynamically from AWS Bedrock API
  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    logger.info('🔍 getDynamicModels called for AmazonBedrock');

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'AMAZON_BEDROCK_API_KEY',
    });

    if (!apiKey) {
      logger.warn('No API key found for AmazonBedrock');
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    logger.info('✅ API key found, fetching models from AWS...');

    try {
      const config = this._parseAndValidateConfig(apiKey);

      // Use AWS SDK to list foundation models
      const models = await this._listBedrockModels(config);

      logger.info(`✅ Retrieved ${models.length} Claude Sonnet models from AWS Bedrock`);
      logger.info('Models:', models.map((m) => m.name).join(', '));

      return models;
    } catch (error) {
      logger.error('❌ Error fetching Bedrock models:', error);
      throw error;
    }
  }

  private async _listBedrockModels(config: AWSBedRockConfig): Promise<ModelInfo[]> {
    const { region, accessKeyId, secretAccessKey, sessionToken } = config;

    // Import AWS SDK on-demand
    const awsSdk = await import('@aws-sdk/client-bedrock');

    const client = new awsSdk.BedrockClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken && { sessionToken }),
      },
    });

    try {
      /*
       * AWS Bedrock ListFoundationModels API
       *
       * Fields returned by API (used):
       * - modelId ✅
       * - modelName ✅
       * - providerName ✅
       * - inferenceTypesSupported ✅ (ON_DEMAND, INFERENCE_PROFILE, PROVISIONED)
       * - outputModalities ✅ (TEXT, IMAGE)
       * - inputModalities ✅ (TEXT, IMAGE)
       * - responseStreamingSupported ✅
       * - modelLifecycle.status ✅ (ACTIVE, LEGACY)
       *
       * Fields NOT returned by API (must be hardcoded):
       * - maxTokens / context window size ❌
       * - pricing information ❌
       * - rate limits ❌
       *
       * Note: We don't filter by inferenceType here because newer models use INFERENCE_PROFILE
       * instead of ON_DEMAND. We'll filter in code to accept both types.
       */
      const command = new awsSdk.ListFoundationModelsCommand({
        byOutputModality: 'TEXT',
      });

      const response = await client.send(command);
      const modelSummaries = response.modelSummaries || [];

      logger.info(`🔍 Found ${modelSummaries.length} total text models from Bedrock in region: ${region}`);

      // Filter models first
      const filteredModels = modelSummaries.filter((model) => {
        // Skip models without required fields
        if (!model.modelId || !model.modelName) {
          return false;
        }

        // Include ACTIVE and LEGACY models (AWS marks older models as LEGACY but they still work)
        const acceptableStatuses = ['ACTIVE', 'LEGACY'];
        const modelStatus = model.modelLifecycle?.status;

        if (!modelStatus || !acceptableStatuses.includes(modelStatus)) {
          return false;
        }

        // Only include models that support text output and streaming
        const supportsText = model.outputModalities?.includes('TEXT');
        const supportsStreaming = model.responseStreamingSupported === true;

        if (!supportsText || !supportsStreaming) {
          return false;
        }

        /*
         * Accept models that support ON_DEMAND or INFERENCE_PROFILE
         * For INFERENCE_PROFILE-only models, we'll use cross-region inference profile IDs
         */
        const inferenceTypes = (model.inferenceTypesSupported || []) as string[];
        const supportsInference = inferenceTypes.includes('ON_DEMAND') || inferenceTypes.includes('INFERENCE_PROFILE');

        if (!supportsInference) {
          return false;
        }

        // Only include Claude Sonnet models from Anthropic (not marketplace)
        const modelIdLower = model.modelId.toLowerCase();
        const isAnthropicClaude = modelIdLower.startsWith('anthropic.claude');
        const isSonnet = modelIdLower.includes('sonnet');

        return isAnthropicClaude && isSonnet;
      });

      // Fetch detailed model info (including token limits) dynamically for each model
      const models = await Promise.all(
        filteredModels.map(async (model) => {
          try {
            /*
             * Call GetFoundationModel API to get detailed model information
             * including inputTokenLimit and outputTokenLimit which are NOT
             * provided by ListFoundationModels
             */
            const getModelCommand = new awsSdk.GetFoundationModelCommand({
              modelIdentifier: model.modelId,
            });
            const modelDetailsResponse = await client.send(getModelCommand);

            // Access token limits dynamically (field names may vary)
            const modelDetails = modelDetailsResponse.modelDetails as any;
            const inputTokenLimit = modelDetails?.maxInputTokens || modelDetails?.inputTokenLimit;
            const outputTokenLimit = modelDetails?.maxOutputTokens || modelDetails?.outputTokenLimit;

            logger.info(`🔍 Processing model ${model.modelId}:`, {
              modelId: model.modelId,
              modelName: model.modelName,
              inferenceTypes: model.inferenceTypesSupported,
              inputTokenLimit,
              outputTokenLimit,
              lifecycle: model.modelLifecycle?.status,
            });

            /*
             * Use AWS Bedrock's actual output token limit from GetFoundationModel API
             * This is the max tokens that can be generated in a response.
             * Using this prevents "maximum tokens you requested exceeds the model limit" errors.
             *
             * Fallback to 4096 if not provided (safe conservative value)
             */
            const maxTokenAllowed = outputTokenLimit || 4096;

            const inferenceTypes = (model.inferenceTypesSupported || []) as string[];
            const supportsOnDemand = inferenceTypes.includes('ON_DEMAND');

            /*
             * For models that only support INFERENCE_PROFILE, use cross-region inference profile ID
             * Format: global.<model-id> (works across all regions)
             * This allows invocation without needing a specific inference profile ARN
             */
            const modelId = !supportsOnDemand ? `global.${model.modelId}` : model.modelId!;

            logger.info(
              `  ✅ ${model.modelName} → ${modelId} (${supportsOnDemand ? 'ON_DEMAND' : 'INFERENCE_PROFILE'}, max output: ${maxTokenAllowed} tokens)`,
            );

            return {
              name: modelId,
              label: `${model.modelName} (${model.providerName})`,
              provider: this.name,
              maxTokenAllowed,
            };
          } catch (error) {
            logger.error(`Failed to get detailed info for model ${model.modelId}:`, error);

            // Fallback: use conservative default if GetFoundationModel fails
            const inferenceTypes = (model.inferenceTypesSupported || []) as string[];
            const supportsOnDemand = inferenceTypes.includes('ON_DEMAND');
            const modelId = !supportsOnDemand ? `global.${model.modelId}` : model.modelId!;

            logger.info(`  ⚠️  Using fallback for ${model.modelName} (max output: 4096 tokens)`);

            return {
              name: modelId,
              label: `${model.modelName} (${model.providerName})`,
              provider: this.name,
              maxTokenAllowed: 4096, // Conservative fallback
            };
          }
        }),
      );

      logger.info(`✅ Retrieved ${models.length} Claude Sonnet models from AWS Bedrock`);

      return models;
    } catch (error) {
      logger.error('AWS SDK error listing models:', error);
      throw error;
    } finally {
      client.destroy();
    }
  }

  private _parseAndValidateConfig(apiKey: string): AWSBedRockConfig {
    let parsedConfig: AWSBedRockConfig;

    try {
      parsedConfig = JSON.parse(apiKey);
    } catch {
      logger.error(
        'Failed to parse AWS Bedrock configuration. Ensure AMAZON_BEDROCK_API_KEY is properly quoted in .env.local',
      );
      throw new Error(
        'Invalid AWS Bedrock configuration format. Please provide a valid JSON string containing region, accessKeyId, and secretAccessKey.',
      );
    }

    const { region, accessKeyId, secretAccessKey, sessionToken } = parsedConfig;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Missing required AWS credentials. Configuration must include region, accessKeyId, and secretAccessKey.',
      );
    }

    return {
      region,
      accessKeyId,
      secretAccessKey,
      ...(sessionToken && { sessionToken }),
    };
  }

  getModelInstance(options: {
    model: string;
    serverEnv: any;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'AMAZON_BEDROCK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const config = this._parseAndValidateConfig(apiKey);
    const bedrock = createAmazonBedrock(config);

    return bedrock(model);
  }
}

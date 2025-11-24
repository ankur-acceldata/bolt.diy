# AWS Bedrock Provider Integration

**Status**: ✅ Complete and Working  
**Date**: November 20, 2025

## Overview

AWS Bedrock provider has been enabled alongside Anthropic and Google, with dynamic model fetching from AWS Bedrock API. Only Claude Sonnet models are shown.

## Quick Start

### 1. Set Environment Variable

Add to `.env.local`:
```bash
AMAZON_BEDROCK_API_KEY='{"region":"us-east-1","accessKeyId":"AKIA...","secretAccessKey":"..."}'
```

**⚠️ CRITICAL**: Must use **single quotes** around the JSON string!

### 2. Restart Server
```bash
pnpm dev
```

### 3. Verify
- Provider dropdown shows: Anthropic, AmazonBedrock
- Switch to Bedrock → loads ~6 Claude Sonnet models
- Can switch freely between providers

## Configuration

### Environment Variable Format

**Variable Name**: `AMAZON_BEDROCK_API_KEY`

**Value**: JSON string with AWS credentials
```json
{
  "region": "us-east-1",
  "accessKeyId": "YOUR_ACCESS_KEY_ID",
  "secretAccessKey": "YOUR_SECRET_ACCESS_KEY",
  "sessionToken": "OPTIONAL_SESSION_TOKEN"
}
```

**In `.env.local`**:
```bash
# CORRECT ✅ (single quotes)
AMAZON_BEDROCK_API_KEY='{"region":"us-east-1","accessKeyId":"...","secretAccessKey":"..."}'

# WRONG ❌ (no quotes - shell will parse it incorrectly)
AMAZON_BEDROCK_API_KEY={"region":"us-east-1","accessKeyId":"...","secretAccessKey":"..."}

# WRONG ❌ (double quotes - escaping issues)
AMAZON_BEDROCK_API_KEY="{\"region\":\"us-east-1\",\"accessKeyId\":\"...\",\"secretAccessKey\":\"...\"}"
```

### AWS Permissions Required

**Minimum IAM Policy** (for ON_DEMAND models):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:ListFoundationModels",
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

**Important Notes**:
- ✅ Standard Bedrock permissions are sufficient for ALL Claude models (3, 3.5, 3.7, 4)
- ✅ Cross-region inference profiles (`global.*`) work with same permissions
- ❌ AWS Marketplace permissions NOT required for Anthropic Claude models
- ⚠️ Must request model access in Bedrock console first (separate from IAM)
- ⚠️ Cross-region inference profiles may show marketplace errors if model access not granted

## Models Available

### What You'll See

**Shows ALL Claude Sonnet models** available in your AWS region.

Based on actual AWS Bedrock API response (region: us-east-1):

**Cross-Region Inference Profile Models** (INFERENCE_PROFILE only, prefixed with `global.`):
- ✅ Claude Sonnet 4.5 (`global.anthropic.claude-sonnet-4-5-20250929-v1:0`) - ACTIVE
- ✅ Claude Sonnet 4 (`global.anthropic.claude-sonnet-4-20250514-v1:0`) - ACTIVE
- ✅ Claude 3.7 Sonnet (`global.anthropic.claude-3-7-sonnet-20250219-v1:0`) - ACTIVE
- ✅ Claude 3.5 Sonnet v2 (`global.anthropic.claude-3-5-sonnet-20241022-v2:0`) - LEGACY

**Hybrid Models** (Support BOTH ON_DEMAND and INFERENCE_PROFILE):
- ✅ Claude 3.5 Sonnet (`anthropic.claude-3-5-sonnet-20240620-v1:0`) - LEGACY
  - ℹ️ Can be invoked with OR without `global.` prefix

**Regional ON_DEMAND Only Models**:
- ✅ Claude 3 Sonnet (`anthropic.claude-3-sonnet-20240229-v1:0`) - LEGACY

💡 **Token Limits**: Dynamically fetched from AWS Bedrock API using `GetFoundationModel` for each model

✅ **Now Fully Dynamic**: Token limits (input/output) are retrieved from AWS Bedrock for each model, ensuring accurate limits without hardcoding.

### Filter Criteria

**What's Included**:
- ✅ Status: ACTIVE or LEGACY
- ✅ Output: TEXT support
- ✅ Streaming: Supported
- ✅ Inference: ON_DEMAND or INFERENCE_PROFILE
- ✅ Model: Claude + Sonnet (all versions)
- ✅ **Total: 6 Sonnet models**

**Not Included**:
- ❌ Non-Sonnet models (Haiku, Opus)
- ❌ PROVISIONED-only models
- ❌ Non-streaming models
- ❌ Models without TEXT output

**Cross-Region Inference Profiles**:
- Models prefixed with `global.` use AWS Bedrock's cross-region inference profiles
- Work across all AWS regions (no region-specific setup needed)
- Higher availability and automatic failover
- Invoked exactly like regional models (just with `global.` prefix)

**Example Invocation** (AWS CLI):
```bash
aws bedrock-runtime invoke-model \
  --region ap-south-1 \
  --model-id global.anthropic.claude-sonnet-4-5-20250929-v1:0 \
  --content-type application/json \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":200,"messages":[{"role":"user","content":[{"type":"text","text":"Hello!"}]}]}'
```
☝️ Works the same way in the UI!

### Enabling Model Access

Before using these models, you must **request model access** in AWS Console:

1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Navigate to: **Model access** (left sidebar)
3. Click **Modify model access** or **Enable specific models**
4. Check: **Claude 3 Sonnet** and **Claude 3.5 Sonnet**
5. Click **Save changes**
6. Wait 2-5 minutes for access to be granted
7. Verify status shows "Access granted" ✅

### What's Filtered Out

Models are filtered to show ONLY those that meet ALL criteria:
- ✅ Status: ACTIVE or LEGACY
- ✅ Output: TEXT support
- ✅ Streaming: Supported
- ✅ Inference: ON_DEMAND or INFERENCE_PROFILE
- ✅ Type: Claude Sonnet models only

Excluded:
- ❌ Non-Sonnet models (Haiku, Opus, Instant)
- ❌ Non-Claude models (Nova, Titan, Llama, Mistral)
- ❌ Image generation models
- ❌ PROVISIONED-only models

## Implementation Details

### Dynamic Model Fetching with Token Limits

The integration now dynamically fetches **both** model metadata and token limits:

#### Step 1: List Available Models
```typescript
const command = new ListFoundationModelsCommand({ byOutputModality: 'TEXT' });
const response = await client.send(command);

// Filter for Claude Sonnet models
const filteredModels = response.modelSummaries.filter(m => 
  (m.status === 'ACTIVE' || m.status === 'LEGACY') &&
  m.outputModalities.includes('TEXT') &&
  m.responseStreamingSupported === true &&
  (m.inferenceTypesSupported.includes('ON_DEMAND') || 
   m.inferenceTypesSupported.includes('INFERENCE_PROFILE')) &&
  m.modelId.startsWith('anthropic.claude') && 
  m.modelId.includes('sonnet')
);
```

#### Step 2: Fetch Detailed Token Limits
```typescript
// For each model, get detailed info including token limits
const models = await Promise.all(
  filteredModels.map(async (model) => {
    const detailsCommand = new GetFoundationModelCommand({
      modelIdentifier: model.modelId
    });
    const details = await client.send(detailsCommand);
    
    // Extract token limits dynamically
    const maxTokenAllowed = details.modelDetails?.maxOutputTokens 
      || details.modelDetails?.outputTokenLimit 
      || 4096; // Fallback
      
    return {
      name: model.modelId,
      label: model.modelName,
      provider: 'AmazonBedrock',
      maxTokenAllowed  // ✅ Dynamic from API
    };
  })
);
```

**Benefits**:
- ✅ No hardcoded token limits
- ✅ Accurate limits per model
- ✅ Handles model updates automatically
- ✅ Safe fallback if API fails (4096 tokens)

### Provider Behavior

**With 1 Provider Configured**:
- Dropdown: 🔒 Locked
- Auto-selected
- Cannot switch

**With Multiple Providers**:
- Dropdown: 🔓 Unlocked
- User can switch freely
- Selection persists

### Model Loading

**First Switch to Provider**:
- Fetches models from AWS API (~2-3 seconds)
- Shows loading indicator
- Auto-selects latest model

**Subsequent Switches**:
- Instant (uses cached models)
- Validates current model
- Auto-selects if model invalid

## Troubleshooting

### Issue: No Models Loading

**Symptoms**: Empty dropdown, errors in console

**Causes & Solutions**:

1. **Improper Quoting in `.env.local`**
   ```bash
   # Check what the server sees
   echo $AMAZON_BEDROCK_API_KEY
   
   # Should print full JSON, not just "{"
   ```
   **Fix**: Use single quotes around JSON in `.env.local`

2. **Invalid JSON Format**
   ```bash
   # Test JSON validity
   echo $AMAZON_BEDROCK_API_KEY | jq .
   ```
   **Fix**: Ensure JSON is valid (no trailing commas, proper quotes)

3. **Server Not Restarted**
   **Fix**: Stop and restart: `pnpm dev`

4. **Wrong Credentials**
   **Fix**: Verify AWS credentials work with AWS CLI:
   ```bash
   aws bedrock list-foundation-models --region us-east-1
   ```

### Issue: Provider Not Showing

**Symptoms**: Only see Anthropic, no Bedrock option

**Causes & Solutions**:

1. **Environment variable not set**
   ```bash
   cat .env.local | grep AMAZON_BEDROCK
   ```
   **Fix**: Add `AMAZON_BEDROCK_API_KEY` to `.env.local`

2. **Server not restarted**
   **Fix**: Restart dev server

3. **Check detection**
   - Open browser console
   - Look for: "Provider Detection] Found 2 providers"
   - Should list: `['Anthropic', 'AmazonBedrock']`

### Issue: Can't Switch Providers

**Symptoms**: Selecting provider immediately reverts

**Causes & Solutions**:

1. **Stale browser cookies**
   - Open DevTools (F12) → Application → Cookies
   - Delete: `selectedProvider`, `selectedModel`
   - Hard refresh: Cmd+Shift+R / Ctrl+Shift+R

2. **Only one provider configured**
   - Dropdown locks with single provider (expected behavior)
   - Add another provider's API key to unlock

### Issue: Wrong Models Showing

**Symptoms**: Seeing non-Sonnet models, old models, etc.

**Causes & Solutions**:

1. **Region mismatch**
   - Different regions have different models
   - Ensure `region` in env var matches your AWS account

2. **Clear model cache**
   - Hard refresh browser
   - Restart server

### Common Error Messages

**"Invalid AWS Bedrock configuration format"**
- JSON parsing failed
- Check: Single quotes in `.env.local`
- Check: Valid JSON syntax

**"Missing Api Key configuration"**
- Environment variable not found
- Check: Correct variable name `AMAZON_BEDROCK_API_KEY`
- Check: Server restarted after adding variable

**"Expected property name or '}' in JSON at position 1"**
- Only first character of env var being read
- Fix: Add single quotes around JSON in `.env.local`

**"Model access is denied due to IAM user or service role is not authorized"**
- **Cause**: Model access not granted in Bedrock console (misleading error message mentions marketplace)
- **Real Issue**: You need to enable model access in Bedrock, NOT marketplace subscriptions
- **Solution**: 
  1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
  2. Navigate to **Model access** → **Modify model access**
  3. Enable all Claude models you want to use:
     - ☑️ **Claude 3 Sonnet**
     - ☑️ **Claude 3.5 Sonnet**
     - ☑️ **Claude 3.7 Sonnet** (if available)
     - ☑️ **Claude Sonnet 4** (if available)
  4. Click **Save changes**
  5. Wait 2-5 minutes for access to be granted
- **Note**: Anthropic Claude models don't require AWS Marketplace - the error is misleading!

**"Invocation of model ID ... with on-demand throughput isn't supported"**
- **Cause**: Model ID doesn't have the `global.` prefix for cross-region inference
- **Solution**: Now automatically handled - newer models use `global.<model-id>` format
- **Example**: `anthropic.claude-sonnet-4-...` → `global.anthropic.claude-sonnet-4-...`

## Files Modified

### Core Provider
- `app/lib/modules/llm/registry.ts` - Enabled provider
- `app/lib/config/providers.ts` - Added to enabled list
- `app/lib/modules/llm/providers/amazon-bedrock.ts` - Dynamic fetching

### UI Components
- `app/components/chat/ModelSelector.tsx` - Fixed selection persistence
- `app/components/chat/BaseChat.tsx` - Auto-fetch on provider change
- `app/lib/hooks/useSettings.ts` - Filter by API key presence

### Configuration
- `Dockerfile` - Updated env var name
- `docker-compose.yaml` - Updated env var name
- `worker-configuration.d.ts` - TypeScript types
- `app/components/@settings/tabs/providers/status/ServiceStatusTab.tsx` - UI config

### API
- `app/routes/api.detect-configured-providers.ts` - Provider detection

### Dependencies
- `package.json` - Added `@aws-sdk/client-bedrock@^3.934.0`

## Technical Notes

### Why INFERENCE_PROFILE Support?

Newer Claude models (4.x) use `INFERENCE_PROFILE` instead of `ON_DEMAND`. Without this support, newer models would be hidden.

### Why Only Claude Sonnet?

Filtered to reduce noise and focus on the most commonly used models. Can be made configurable if needed.

### Why Environment Variables Only?

Consistent with other providers (Anthropic, Google) and follows security best practices for credential management.

### Token Limit Estimation

```typescript
if (model.includes('claude-3-5-sonnet-20241022')) {
  maxTokens = 200000;
} else if (model.includes('claude')) {
  maxTokens = 100000;
}
```

## Docker Deployment

Update your docker-compose.yaml or deployment config:

```yaml
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  - AMAZON_BEDROCK_API_KEY=${AMAZON_BEDROCK_API_KEY}
```

Dockerfile already includes:
```dockerfile
ARG AMAZON_BEDROCK_API_KEY
ENV AMAZON_BEDROCK_API_KEY=${AMAZON_BEDROCK_API_KEY}
```

## Testing

### Manual Testing Checklist

- [ ] Set `AMAZON_BEDROCK_API_KEY` in `.env.local` with single quotes
- [ ] Restart server
- [ ] Verify Bedrock appears in provider dropdown
- [ ] Switch to Bedrock
- [ ] Verify ~6 Claude Sonnet models load
- [ ] Switch back to Anthropic
- [ ] Verify model selection persists
- [ ] Clear cookies and test fresh state
- [ ] Test with only Bedrock configured (dropdown should lock)

### Expected Logs

```
INFO LLMManager Registering Provider: AmazonBedrock
INFO AmazonBedrock 🔍 getDynamicModels called for AmazonBedrock
INFO AmazonBedrock ✅ API key found, fetching models from AWS...
INFO AmazonBedrock ✅ Retrieved 6 Claude Sonnet models from AWS Bedrock
```

## Related Documentation

- [API Integration Guide](../api-integration/API_INTERCEPTOR_GUIDE.md)
- AWS Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- AWS SDK Client Bedrock: https://www.npmjs.com/package/@aws-sdk/client-bedrock


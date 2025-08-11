import { getAcceldataApiUrl } from '~/lib/config';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AcceldataService');

export interface AcceldataApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  additionalHeaders?: Record<string, string>;
  requestHeaders?: Headers | Record<string, string>;
  request?: Request;
}

export interface AcceldataApiResponse<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  details?: any;
  message?: string;
}

/**
 * Centralized Acceldata API service
 * Handles authentication, headers, and common request/response patterns
 */
export class AcceldataService {
  /**
   * Headers that should not be forwarded to backend services
   */
  private static readonly _filteredHeaders = new Set([
    'host',
    'content-length',
    'connection',
    'cache-control',
    'pragma',
    'postman-token',
    'cookie',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'dnt',
    'priority',
  ]);

  /**
   * Convert Headers object to plain object and filter out unwanted headers
   */
  private static _headersToRecord(headers: Headers | Record<string, string>): Record<string, string> {
    const record: Record<string, string> = {};

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        // Only include headers that are not in the filtered list
        if (!this._filteredHeaders.has(key.toLowerCase())) {
          record[key] = value;
        }
      });
    } else {
      // For plain objects, filter as well
      Object.entries(headers).forEach(([key, value]) => {
        if (!this._filteredHeaders.has(key.toLowerCase())) {
          record[key] = value;
        }
      });
    }

    return record;
  }

  private static _getStandardHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-User-Name': 'Tanaya',
      'X-Tenant-ID': '1234',
      'X-Tenant-Name': 'TestTenant',
      'X-User-ID': '5678',
      'Content-Type': 'application/json',
    };

    // Add access keys if available (optional)
    const accessKey = process.env.ACCELDATA_ACCESS_KEY;
    const secretKey = process.env.ACCELDATA_SECRET_KEY;

    if (accessKey) {
      headers.accessKey = accessKey;
    }

    if (secretKey) {
      headers.secretKey = secretKey;
    }

    return headers;
  }

  /**
   * Extract authorization header from request cookies (for server-side context)
   */
  private static _extractAuthFromCookies(requestHeaders?: Headers | Record<string, string>): Record<string, string> {
    const authHeaders: Record<string, string> = {};

    if (!requestHeaders) {
      return authHeaders;
    }

    let cookieHeader: string | null = null;

    if (requestHeaders instanceof Headers) {
      cookieHeader = requestHeaders.get('cookie');
    } else {
      cookieHeader = requestHeaders.cookie || requestHeaders.Cookie || null;
    }

    if (cookieHeader?.includes('acceldata_access_token=')) {
      const tokenMatch = cookieHeader.match(/acceldata_access_token=([^;]+)/);

      if (tokenMatch) {
        const accessToken = tokenMatch[1];
        authHeaders.Authorization = `Bearer ${accessToken}`;
        logger.debug('Extracted authorization token from cookies');
      }
    }

    return authHeaders;
  }

  /**
   * Make an API call to Acceldata service
   */
  static async call<T = any>(path: string, options: AcceldataApiOptions = {}): Promise<AcceldataApiResponse<T>> {
    const { method = 'GET', body, additionalHeaders = {}, requestHeaders, request } = options;

    try {
      const endpoint = getAcceldataApiUrl(path, request);
      logger.info(`Making ${method} request to: ${endpoint}`);

      /*
       * Build headers in order of precedence:
       * 1. Start with forwarded request headers (lowest priority)
       * 2. Apply authorization from cookies if no auth header present (medium-low priority)
       * 3. Apply additional headers (medium priority)
       * 4. Apply Acceldata standard headers (highest priority)
       */
      const forwardedHeaders = requestHeaders ? this._headersToRecord(requestHeaders) : {};
      const cookieAuthHeaders =
        !forwardedHeaders.Authorization && !forwardedHeaders.authorization
          ? this._extractAuthFromCookies(requestHeaders)
          : {};
      const headers = {
        ...forwardedHeaders,
        ...cookieAuthHeaders,
        ...additionalHeaders,
        ...this._getStandardHeaders(),
      };

      logger.debug('Request headers being forwarded:', Object.keys(forwardedHeaders));
      logger.debug('Final headers count:', Object.keys(headers).length);

      // Remove Content-Type for GET requests unless explicitly set
      if (method === 'GET' && !additionalHeaders['Content-Type']) {
        delete headers['Content-Type'];
      }

      const requestOptions: RequestInit = {
        method,
        headers,
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        logger.debug('Request payload:', body);
      }

      const response = await fetch(endpoint, requestOptions);
      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        logger.error(`API call failed: ${response.status} ${response.statusText}`, {
          endpoint,
          method,
          responseData,
        });

        return {
          success: false,
          status: response.status,
          error: `API call failed: ${response.status} ${response.statusText}`,
          details: responseData,
        };
      }

      logger.info(`API call successful: ${response.status}`, {
        endpoint,
        method,
        dataSize: JSON.stringify(responseData).length,
      });

      return {
        success: true,
        status: response.status,
        data: responseData as T,
      };
    } catch (error) {
      logger.error('API call error:', error);

      return {
        success: false,
        status: 500,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute an adhoc run
   */
  static async executeAdhocRun(config: any, request?: Request): Promise<AcceldataApiResponse> {
    logger.info('Executing adhoc run with config:', config);

    // Generate curl command for debugging
    try {
      const endpoint = getAcceldataApiUrl('/xdp-cp-service/api/adhoc-runs', request);
      const headers = {
        ...(request?.headers ? this._headersToRecord(request.headers) : {}),
        ...this._getStandardHeaders(),
      };

      const curlHeaders = Object.entries(headers)
        .map(([key, value]) => `-H '${key}: ${value}'`)
        .join(' ');

      const curlBody = ` --data '${JSON.stringify(config)}'`;
      const curlCommand = `curl -X POST ${curlHeaders}${curlBody} '${endpoint}'`;

      logger.info(`CURL equivalent for adhoc run:\n${curlCommand}`);
    } catch (curlError) {
      logger.warn('Failed to generate curl command:', curlError);
    }

    const result = await this.call('/xdp-cp-service/api/adhoc-runs', {
      method: 'POST',
      body: config,
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = 'Adhoc run executed successfully';
    }

    return result;
  }

  /**
   * Get pipeline audit data
   */
  static async getPipelineAudit(runId: string | number, request?: Request): Promise<AcceldataApiResponse> {
    logger.info(`Fetching audit for run ${runId}`);

    const result = await this.call(`/xdp-cp-service/api/pipelines/runs/${runId}/audit`, {
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = `Audit for run ${runId} fetched successfully`;
    }

    return result;
  }

  /**
   * Execute a pipeline
   */
  static async executePipeline(pipelineId: number = 5, request?: Request): Promise<AcceldataApiResponse> {
    logger.info(`Executing pipeline ${pipelineId}`);

    const result = await this.call(`/xdp-cp-service/api/pipelines/${pipelineId}/execute`, {
      method: 'POST',
      body: '',
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = 'Pipeline executed successfully';
    }

    return result;
  }

  /**
   * Get log stream endpoint URL (for SSE)
   * This doesn't make the actual call since it's for streaming
   */
  static getLogStreamUrl(dataplaneId: string, podName: string, tailLines: string = '50', request?: Request): string {
    return getAcceldataApiUrl(
      `/xdp-cp-service/api/dataplane/${dataplaneId}/logs/${podName}/sse?tailLines=${tailLines}`,
      request,
    );
  }

  /**
   * Get authentication headers for external use (like in SSE streams)
   */
  static getAuthHeaders(): Record<string, string> {
    const standardHeaders = this._getStandardHeaders();
    const authHeaders: Record<string, string> = {};

    if (standardHeaders.accessKey) {
      authHeaders.accessKey = standardHeaders.accessKey;
    }

    if (standardHeaders.secretKey) {
      authHeaders.secretKey = standardHeaders.secretKey;
    }

    return authHeaders;
  }

  /**
   * Make a streaming API call (for SSE, downloads, etc.)
   * Returns the raw Response object for custom handling
   */
  static async callStream(path: string, options: AcceldataApiOptions = {}): Promise<Response> {
    const { method = 'GET', body, additionalHeaders = {}, requestHeaders, request } = options;

    const endpoint = getAcceldataApiUrl(path, request);
    logger.info(`Making ${method} stream request to: ${endpoint}`);

    /*
     * Build headers in order of precedence:
     * 1. Start with forwarded request headers (lowest priority)
     * 2. Apply authorization from cookies if no auth header present (medium-low priority)
     * 3. Apply additional headers (medium priority)
     * 4. Apply Acceldata standard headers (highest priority)
     */
    const forwardedHeaders = requestHeaders ? this._headersToRecord(requestHeaders) : {};
    const cookieAuthHeaders =
      !forwardedHeaders.Authorization && !forwardedHeaders.authorization
        ? this._extractAuthFromCookies(requestHeaders)
        : {};
    const headers = {
      ...forwardedHeaders,
      ...cookieAuthHeaders,
      ...additionalHeaders,
      ...this._getStandardHeaders(),
    };

    logger.debug('Stream request headers being forwarded:', Object.keys(forwardedHeaders));
    logger.debug('Final stream headers count:', Object.keys(headers).length);

    // Remove Content-Type for GET requests unless explicitly set
    if (method === 'GET' && !additionalHeaders['Content-Type']) {
      delete headers['Content-Type'];
    }

    const requestOptions: RequestInit = {
      method,
      headers,
      signal: request?.signal, // Pass through abort signal for SSE
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      logger.debug('Stream request payload:', body);
    }

    // Log the curl command for debugging
    const curlHeaders = Object.entries(headers)
      .map(([key, value]) => `-H '${key}: ${value}'`)
      .join(' ');
    const curlCommand = `curl -N ${curlHeaders} '${endpoint}'`;
    logger.info(`Stream CURL command:\n${curlCommand}`);

    return fetch(endpoint, requestOptions);
  }

  /**
   * Check if service is configured properly
   */
  static isConfigured(): boolean {
    // Service is always configured now since accessKey/secretKey are optional
    return true;
  }
}

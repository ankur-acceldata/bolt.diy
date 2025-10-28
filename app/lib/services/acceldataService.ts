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
      'Content-Type': 'application/json',
    };

    // Add access keys if available (optional)
    const accessKey = process.env.API_ACCESS_KEY;
    const secretKey = process.env.API_SECRET_KEY;

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

      // Normalize header casing: prefer 'Authorization'
      if (!('Authorization' in headers) && 'authorization' in headers) {
        (headers as Record<string, string>).Authorization = (headers as Record<string, string>).authorization;
        delete (headers as Record<string, string>).authorization;
      }

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
      logger.error('API call error:', JSON.stringify(error, null, 2));

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
      const endpoint = getAcceldataApiUrl('/api/job/adhoc-runs', request);
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

    const result = await this.call('/api/job/adhoc-runs', {
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
   * Execute a pipeline adhoc run
   */
  static async executePipelineAdhocRun(config: any, request?: Request): Promise<AcceldataApiResponse> {
    logger.info('Executing pipeline adhoc run with config:', config);

    // Generate curl command for debugging
    try {
      const endpoint = getAcceldataApiUrl('/api/pipelines/adhoc-runs', request);
      const headers = {
        ...(request?.headers ? this._headersToRecord(request.headers) : {}),
        ...this._getStandardHeaders(),
      };

      const curlHeaders = Object.entries(headers)
        .map(([key, value]) => `-H '${key}: ${value}'`)
        .join(' ');

      const curlBody = ` --data '${JSON.stringify(config)}'`;
      const curlCommand = `curl -X POST ${curlHeaders}${curlBody} '${endpoint}'`;

      logger.info(`CURL equivalent for pipeline adhoc run:\n${curlCommand}`);
    } catch (curlError) {
      logger.warn('Failed to generate curl command:', curlError);
    }

    const result = await this.call('/api/pipelines/adhoc-runs', {
      method: 'POST',
      body: config,
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = 'Pipeline adhoc run executed successfully';
    }

    return result;
  }

  /**
   * Get pipeline audit data
   */
  static async getPipelineAudit(runId: string | number, request?: Request): Promise<AcceldataApiResponse> {
    logger.info(`Fetching audit for run ${runId}`);

    const result = await this.call(`/api/pipelines/runs/${runId}/audit`, {
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

    const result = await this.call(`/api/pipelines/${pipelineId}/execute`, {
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
  static getLogStreamUrl(dataplaneId: string, runId: string, tailLines: string = '50', request?: Request): string {
    return getAcceldataApiUrl(`/api/job/run/logs/${runId}/sse?tailLines=${tailLines}`, request);
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

    // Normalize header casing: prefer 'Authorization'
    if (!('Authorization' in headers) && 'authorization' in headers) {
      (headers as Record<string, string>).Authorization = (headers as Record<string, string>).authorization;
      delete (headers as Record<string, string>).authorization;
    }

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
   * Create a new project
   */
  static async createProject(projectData: any, request?: Request): Promise<AcceldataApiResponse> {
    logger.info('Creating new project:', projectData);

    const endpoint = getAcceldataApiUrl('/api/projects', request);

    const headers = {
      ...(request?.headers ? this._headersToRecord(request.headers) : {}),
      ...this._getStandardHeaders(),
    };

    const curlHeaders = Object.entries(headers)
      .map(([key, value]) => `-H '${key}: ${value}'`)
      .join(' ');

    const curlBody = ` --data '${JSON.stringify(projectData)}'`;
    const curlCommand = `curl -X POST ${curlHeaders}${curlBody} '${endpoint}'`;

    logger.info(`CURL equivalent for adhoc run:\n${curlCommand}`);

    const result = await this.call('/api/projects', {
      method: 'POST',
      body: projectData,
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = 'Project created successfully';
    }

    return result;
  }

  /**
   * Get all projects
   */
  static async getAllProjects(request?: Request): Promise<AcceldataApiResponse> {
    logger.info('Fetching all projects');

    const result = await this.call('/api/projects', {
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = 'Projects fetched successfully';
    }

    return result;
  }

  /**
   * Get project by ID
   */
  static async getProjectById(projectId: string | number, request?: Request): Promise<AcceldataApiResponse> {
    logger.info(`Fetching project ${projectId}`);

    const result = await this.call(`/api/projects/${projectId}`, {
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = `Project ${projectId} fetched successfully`;
    }

    return result;
  }

  /**
   * Update project by ID
   */
  static async updateProject(
    projectId: string | number,
    projectData: any,
    request?: Request,
  ): Promise<AcceldataApiResponse> {
    logger.info(`Updating project ${projectId}:`, JSON.stringify(projectData, null, 2));

    const result = await this.call(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: projectData,
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = `Project ${projectId} updated successfully`;
    }

    return result;
  }

  /**
   * Create user session for a project
   */
  static async createUserSession(
    projectId: string | number,
    sessionData: any,
    request?: Request,
  ): Promise<AcceldataApiResponse> {
    logger.info(`Creating user session for project ${projectId}:`, sessionData);

    const result = await this.call(`/api/projects/${projectId}/sessions`, {
      method: 'POST',
      body: sessionData,
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = `User session created successfully for project ${projectId}`;
    }

    return result;
  }

  /**
   * Get all sessions by project ID
   */
  static async getAllSessionsByProjectId(projectId: string | number, request?: Request): Promise<AcceldataApiResponse> {
    logger.info(`Fetching all sessions for project ${projectId}`);

    const result = await this.call(`/api/projects/${projectId}/sessions`, {
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = `Sessions for project ${projectId} fetched successfully`;
    }

    return result;
  }

  /**
   * Get latest session for project ID
   */
  static async getLatestSessionForProjectId(
    projectId: string | number,
    request?: Request,
  ): Promise<AcceldataApiResponse> {
    logger.info(`Fetching latest session for project ${projectId}`);

    const result = await this.call(`/api/projects/${projectId}/sessions/latest`, {
      requestHeaders: request?.headers,
      request,
    });

    if (result.success) {
      result.message = `Latest session for project ${projectId} fetched successfully`;
    }

    return result;
  }

  /**
   * Check if service is configured properly
   */
  static isConfigured(): boolean {
    // Service is always configured now since accessKey/secretKey are optional
    return true;
  }
}

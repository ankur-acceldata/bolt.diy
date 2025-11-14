/**
 * TypeScript interfaces for backend API responses
 * These types ensure type safety when interacting with backend APIs
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Project data structure
 */
export interface ProjectData {
  id: number | string; // Can be either number or string depending on source
  name: string;
  description?: string;
  url?: string;
  dataplaneId?: number;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Project API response (may have nested data structure)
 */
export interface ProjectResponse {
  data?: ProjectData;
  id?: number | string; // Can be either number or string depending on source
  name?: string;
  description?: string;
  url?: string;
  dataplaneId?: number;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Session data structure
 */
export interface SessionData {
  id: number;
  projectId: number;
  session: string;
  dataplaneId?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Sessions list response (may have nested data structure)
 */
export interface SessionsResponse {
  success: boolean;
  data?:
    | {
        data?: SessionData[];
      }
    | SessionData[];
  error?: string;
}

/**
 * Session create/update response
 */
export interface SessionResponse {
  success: boolean;
  data?: {
    id?: number;
    data?: {
      id?: number;
    };
  };
  error?: string;
}

/**
 * Helper function to extract project data from potentially nested response
 */
export function extractProjectData(response: ProjectResponse | ApiResponse<ProjectData>): ProjectData {
  // Handle nested response structure (response.data might have .data property)
  if ('data' in response && response.data) {
    return response.data as ProjectData;
  }

  // Handle flat response structure
  return response as ProjectData;
}

/**
 * Helper function to extract sessions array from potentially nested response
 */
export function extractSessionsArray(response: SessionsResponse): SessionData[] {
  if (!response.data) {
    return [];
  }

  // Handle nested array structure
  if ('data' in response.data && Array.isArray(response.data.data)) {
    return response.data.data;
  }

  // Handle flat array structure
  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

/**
 * Type guard to check if response is an API response wrapper
 */
export function isApiResponse<T>(response: any): response is ApiResponse<T> {
  return response && typeof response === 'object' && 'success' in response && typeof response.success === 'boolean';
}

/**
 * Type guard to check if value is a ProjectData
 */
export function isProjectData(value: any): value is ProjectData {
  return value && typeof value === 'object' && ('id' in value || 'name' in value);
}

/**
 * Type guard to check if value is a SessionData
 */
export function isSessionData(value: any): value is SessionData {
  return value && typeof value === 'object' && 'id' in value && 'projectId' in value && 'session' in value;
}

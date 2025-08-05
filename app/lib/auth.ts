/**
 * Authentication utilities for handling access tokens and authorization headers
 *
 * This module provides utilities for:
 * - Extracting access tokens from browser cookies
 * - Generating authorization headers for API calls
 * - Managing authentication state
 *
 * @example
 * ```typescript
 * import { AuthUtils } from '~/lib/auth';
 *
 * // Get access token from cookies
 * const token = AuthUtils.getAccessTokenFromCookie();
 *
 * // Get auth headers for API calls
 * const headers = AuthUtils.getAuthHeaders();
 * ```
 */

/**
 * Authentication utility class for handling access tokens
 */
export class AuthUtils {
  /**
   * Get access token from browser cookies
   * @returns The access token string or null if not found
   */
  static getAccessTokenFromCookie(): string | null {
    // Only access cookies in browser environment
    if (typeof window !== 'undefined') {
      const cookieString = document.cookie;
      const cookies = cookieString.split(';').map((cookie) => cookie.trim());

      for (const cookie of cookies) {
        if (cookie.startsWith('acceldata_access_token=')) {
          return cookie.substring('acceldata_access_token='.length);
        }
      }
    }

    return null;
  }

  /**
   * Generate authorization headers for API calls
   * @returns Object containing authorization and tenant headers
   */
  static getAuthHeaders(): Record<string, string> {
    const accessToken = AuthUtils.getAccessTokenFromCookie();

    return {
      authorization: accessToken ? `Bearer ${accessToken}` : '',
      'ad-tenant': 'acceldata',
    };
  }
}

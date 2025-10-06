import { useState, useEffect } from 'react';
import { ProjectService } from '~/lib/services/projectService';
import type { DataplaneInfoPayload } from '~/types/communicationBus';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Usedataplaneinfo');

/**
 * React hook to get dataplane information from parent iframe
 *
 * @returns DataplaneInfoPayload | undefined
 *
 * Usage:
 * ```typescript
 * const dataplaneInfo = useDataplaneInfo();
 * if (dataplaneInfo) {
 *   logger.debug('Dataplane ID:', dataplaneInfo.dataplaneId);
 *   logger.debug('Dataplane Name:', dataplaneInfo.dataplaneName);
 * }
 * ```
 */
export function useDataplaneInfo(): DataplaneInfoPayload | undefined {
  const [dataplaneInfo, setDataplaneInfo] = useState<DataplaneInfoPayload | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    async function fetchDataplaneInfo() {
      try {
        logger.debug('Fetching dataplane info...');

        const info = await ProjectService.getDataplaneInfo();

        if (isMounted) {
          setDataplaneInfo(info);
          logger.info('Dataplane info loaded:', {
            dataplaneId: info?.dataplaneId,
            dataplaneName: info?.dataplaneName,
          });
        }
      } catch (error) {
        logger.error('Failed to fetch dataplane info:', error);

        if (isMounted) {
          setDataplaneInfo(undefined);
        }
      }
    }

    fetchDataplaneInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  return dataplaneInfo;
}

/**
 * Extended version of the hook that also provides loading state
 *
 * @returns Object with dataplaneInfo, isLoading, and error state
 *
 * Usage:
 * ```typescript
 * const { dataplaneInfo, isLoading, error } = useDataplaneInfoWithState();
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error loading dataplane info</div>;
 * if (dataplaneInfo) return <div>Dataplane: {dataplaneInfo.dataplaneName}</div>;
 * ```
 */
export function useDataplaneInfoWithState() {
  const [dataplaneInfo, setDataplaneInfo] = useState<DataplaneInfoPayload | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    async function fetchDataplaneInfo() {
      try {
        setIsLoading(true);
        setError(undefined);
        logger.debug('Fetching dataplane info with state...');

        const info = await ProjectService.getDataplaneInfo();

        if (isMounted) {
          setDataplaneInfo(info);
          logger.info('Dataplane info loaded successfully:', {
            dataplaneId: info?.dataplaneId,
            dataplaneName: info?.dataplaneName,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dataplane info';
        logger.error('Failed to fetch dataplane info:', err);

        if (isMounted) {
          setError(errorMessage);
          setDataplaneInfo(undefined);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDataplaneInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  return { dataplaneInfo, isLoading, error };
}

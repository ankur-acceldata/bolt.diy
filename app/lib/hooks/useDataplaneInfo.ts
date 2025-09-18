import { useState, useEffect } from 'react';
import { ProjectService } from '~/lib/services/projectService';
import type { DataplaneInfoPayload } from '~/types/communicationBus';

/**
 * React hook to get dataplane information from parent iframe
 *
 * @returns DataplaneInfoPayload | undefined
 *
 * Usage:
 * ```typescript
 * const dataplaneInfo = useDataplaneInfo();
 * if (dataplaneInfo) {
 *   console.log('Dataplane ID:', dataplaneInfo.dataplaneId);
 *   console.log('Dataplane Name:', dataplaneInfo.dataplaneName);
 * }
 * ```
 */
export function useDataplaneInfo(): DataplaneInfoPayload | undefined {
  const [dataplaneInfo, setDataplaneInfo] = useState<DataplaneInfoPayload | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    async function fetchDataplaneInfo() {
      try {
        const info = await ProjectService.getDataplaneInfo();

        if (isMounted) {
          setDataplaneInfo(info);
        }
      } catch {
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

        const info = await ProjectService.getDataplaneInfo();

        if (isMounted) {
          setDataplaneInfo(info);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dataplane info';

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

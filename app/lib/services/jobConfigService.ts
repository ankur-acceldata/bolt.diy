import { MessageType } from '~/types/communicationBus';
import type { JobConfig } from '~/types/jobConfig';

interface CommunicationBus {
  sendMessageWithResponse: <R = any>(message: any, options?: any) => Promise<R>;
  on: (type: string, handler: (payload?: any, message?: any) => void) => () => void;
}

export async function getEditedJobConfigFromXdp(bus: CommunicationBus, stages: string[]): Promise<JobConfig> {
  return new Promise((resolve, reject) => {
    let unsubscribeCancelled: (() => void) | null = null;

    // Subscribe to cancellation message
    unsubscribeCancelled = bus.on(MessageType.ADHOC_RUN_CANCELLED, () => {
      // Clean up subscription
      if (unsubscribeCancelled) {
        unsubscribeCancelled();
      }

      // Reject the promise with a cancellation error
      reject(new Error('Process cancelled'));
    });

    // Send the message and wait for response
    bus
      .sendMessageWithResponse<JobConfig[] | JobConfig>(
        {
          type: MessageType.ADHOC_RUN,
          payload: {
            stages,
          },
        },
        {
          responseType: MessageType.ADHOC_RUN_RESPONSE,
          timeout: 100000,
        },
      )
      .then((response) => {
        // Clean up cancellation subscription on success
        if (unsubscribeCancelled) {
          unsubscribeCancelled();
        }

        // Handle both array and single object responses
        if (Array.isArray(response)) {
          if (response.length === 0) {
            throw new Error('No job configuration received from XDP');
          }

          resolve(response[0]); // Return the first (and likely only) JobConfig object
        } else {
          resolve(response); // Return the single JobConfig object
        }
      })
      .catch((error) => {
        // Clean up cancellation subscription on error
        if (unsubscribeCancelled) {
          unsubscribeCancelled();
        }

        reject(error);
      });
  });
}

export async function getJobConfigFromXdp(bus: CommunicationBus, stages: string[]): Promise<JobConfig> {
  const response = await bus.sendMessageWithResponse<JobConfig[] | JobConfig>(
    {
      type: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG,
      payload: {
        stages,
      },
    },
    {
      responseType: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG,
      timeout: 100000,
    },
  );

  // Handle both array and single object responses
  if (Array.isArray(response)) {
    if (response.length === 0) {
      throw new Error('No job configuration received from XDP');
    }

    return response[0]; // Return the first (and likely only) JobConfig object
  }

  return response; // Return the single JobConfig object
}

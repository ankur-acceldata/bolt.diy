import { MessageType } from '~/types/communicationBus';
import type { JobConfig } from '~/types/jobConfig';

interface CommunicationBus {
  sendMessageWithResponse: <R = any>(message: any, options?: any) => Promise<R>;
}

export async function getEditedJobConfigFromXdp(bus: CommunicationBus, stages: string[]): Promise<JobConfig> {
  const response = await bus.sendMessageWithResponse<JobConfig[] | JobConfig>(
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

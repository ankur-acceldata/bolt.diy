/**
 * Communication Bus Types - Clean and minimal type definitions
 */

export enum MessageType {
  // System messages
  READY = 'READY',
  ERROR = 'ERROR',
  DATAPLANE_INFO = 'DATAPLANE_INFO',

  // Health check messages (to prevent iframe freezing after idle)
  HEARTBEAT = 'HEARTBEAT',
  WAKE_UP = 'WAKE_UP',
  WAKE_UP_RESPONSE = 'WAKE_UP_RESPONSE',

  // Demo/Test messages
  GET_DATA = 'GET_DATA',
  DATA_RESPONSE = 'DATA_RESPONSE',
  TEST_MESSAGE = 'TEST_MESSAGE',
  DEMO_MESSAGE = 'DEMO_MESSAGE',

  // Workbench messages
  ADHOC_RUN = 'ADHOC_RUN',
  ADHOC_RUN_RESPONSE = 'ADHOC_RUN_RESPONSE',
  ADHOC_RUN_CANCELLED = 'ADHOC_RUN_CANCELLED',
  GET_DEFAULT_ADHOC_RUN_CONFIG = 'GET_DEFAULT_ADHOC_RUN_CONFIG',
  GET_DEFAULT_ADHOC_RUN_CONFIG_RESPONSE = 'GET_DEFAULT_ADHOC_RUN_CONFIG_RESPONSE',
  GET_PIPELINE_CONFIG = 'GET_PIPELINE_CONFIG',
  GET_PIPELINE_CONFIG_RESPONSE = 'GET_PIPELINE_CONFIG_RESPONSE',
  GET_PROJECT_ID = 'GET_PROJECT_ID',
  GET_PROJECT_ID_RESPONSE = 'GET_PROJECT_ID_RESPONSE',
  GET_DATAPLANE_INFO = 'GET_DATAPLANE_INFO',
  GET_DATAPLANE_INFO_RESPONSE = 'GET_DATAPLANE_INFO_RESPONSE',

  // Response status messages
  RESPONSE_IN_PROGRESS = 'ResponseInProgress',
  RESPONSE_GENERATED = 'ResponseGenerated',
  RESPONSE_RESET = 'ResponseReset',
  GET_RESPONSE_STATUS = 'GetResponseStatus',
  RESPONSE_STATUS = 'ResponseStatus',

  // Job promotion messages
  PROMOTE_TO_JOB = 'PROMOTE_TO_JOB',
  PROMOTE_TO_JOB_RESPONSE = 'PROMOTE_TO_JOB_RESPONSE',
}

export interface BusMessage<T = any> {
  type: string;
  payload?: T;
  messageId?: string;
  responseId?: string;
  timestamp?: number;
  source?: string;
  visibility?: 'private' | 'public';
  reason?: string;
}

export type MessageHandler<T = any> = (payload: T, message: BusMessage<T>) => void;

export interface CommunicationBusConfig {
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
  timeout?: number;
  targetOrigin?: string;
  messageQueueSize?: number;
}

export interface BusStatus {
  isConnected: boolean;
  isReady: boolean;
  messagesSent: number;
  messagesReceived: number;
  pendingResponses: number;
  queuedMessages: number;
}

export interface DataplaneInfoPayload {
  dataplaneId: string;
  dataplaneName: string;
}

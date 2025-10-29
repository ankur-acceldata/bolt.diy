/**
 * Job Configuration types from XDP
 */
export enum JobType {
  SPARK_CONNECT_PYTHON_ADHOC = 'SPARK_CONNECT_PYTHON_ADHOC',
  SPARK_CONNECT_JAVA_ADHOC = 'SPARK_CONNECT_JAVA_ADHOC',
}

export interface JobConfig {
  baseImage: string;
  dataplaneName: string;
  dataplaneId: string;
  stages: string[];
  depends: {
    dataStores: Array<{
      dataStoreId: number;
    }>;
  };
  executionConfig: {
    imagePullSecrets: string[];
    imagePullPolicy: string;
    dynamicAllocation: {
      enabled: boolean;
      initialExecutors: number;
      minExecutors: number;
      maxExecutors: number;
      shuffleTrackingTimeout: number;
    };
    driver: {
      cores: number;
      memory: string;
      memoryOverhead: string;
    };
    executor: {
      cores: number;
      memory: string;
      memoryOverhead: string;
    };
    sparkConfig: Record<string, any>;
  };
}

export interface AdhocRunRequestBody {
  dataplaneId: number | string;
  jobType: JobType | string;
  description?: string;
  name?: string;
  executionConfig: {
    jobType: JobType | string;
    image: string;
    imagePullSecrets: string[];
    imagePullPolicy: string;
    codeSource: {
      type: 'MINIO' | string;
      config: {
        url: string;
        additionalParams?: unknown;
      };
    };
    stages: string[];
    type: 'Python' | 'Java' | string;
    mode: 'cluster' | string;
    driver: {
      cores: number;
      memory: string;
      memoryOverhead: string;
    };
    executor: {
      instances?: number;
      cores: number;
      memory: string;
      memoryOverhead: string;
    };
    dynamicAllocation: {
      enabled: boolean;
      initialExecutors: number;
      minExecutors: number;
      maxExecutors: number;
      shuffleTrackingTimeout?: number;
    };
    depends: {
      dataStores: Array<{ dataStoreId?: number }>;
    };
    sparkConf: Record<string, any>;
    timeToLiveSeconds?: number | null;
    runConf?: {
      IS_BOLT?: string;
      [key: string]: string | undefined;
    };
  };
}

export interface ExecuteAdhocRunResponse {
  errorCode: number;
  success: boolean;
  message: string;
  detailedMessage?: string;
  data?: {
    id: number;
    jobId?: number;
    jobRunRequestId?: string;
    dataplaneName?: string;
    status?: string;
    executionConfig?: AdhocRunRequestBody['executionConfig'];
    log?: string | null;
    logLink?: string | null;
    jobLink?: string | null;
    retryCount?: number;
    triggerType?: string;
    startTime?: string;
    endTime?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  meta?: unknown;
}

export interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  metadata?: {
    gitUrl?: string;
  };
  updateChatMestaData?: (metadata: any) => void;
  setSelectedElement?: (element: any | null) => void; // Using any for now since ElementInfo is internal
  selectedTemplate?: {
    id: string;
    name: string;
  };
  onSendMessage?: (message: string) => void;
  onSetChatInput?: (message: string) => void;
}

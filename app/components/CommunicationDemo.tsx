import React, { useState, useEffect } from 'react';
import { useCommunicationBusChild } from '~/lib/hooks/useCommunicationBus';
import { MessageType } from '~/types/communicationBus';

/**
 * Simple demo component to test communication bus functionality
 * Remove this component in production if not needed
 */
export function CommunicationDemo() {
  const bus = useCommunicationBusChild();
  const [lastMessage, setLastMessage] = useState<string>('');

  // Listen for messages from parent
  useEffect(() => {
    const unsubscribe = bus.on(MessageType.DEMO_MESSAGE, (payload) => {
      setLastMessage(`Received: ${JSON.stringify(payload)}`);
    });

    return unsubscribe;
  }, [bus]);

  const sendTestMessage = () => {
    bus.sendMessage({
      type: MessageType.TEST_MESSAGE,
      payload: { message: 'Hello from bolt.diy!', timestamp: Date.now() },
    });
    setLastMessage('Sent test message to parent');
  };

  const requestData = async () => {
    try {
      const response = await bus.sendMessageWithResponse({
        type: MessageType.GET_DATA,
        payload: { request: 'demo_data' },
      });
      setLastMessage(`Response: ${JSON.stringify(response)}`);
    } catch (error) {
      setLastMessage(`Error: ${error}`);
    }
  };

  const requestDataWithSpecificResponseType = async () => {
    try {
      // Example: Send GET_DATA but expect a DATA_RESPONSE type back
      const response = await bus.sendMessageWithResponse(
        {
          type: MessageType.GET_DATA,
          payload: { request: 'demo_data' },
        },
        {
          responseType: MessageType.DATA_RESPONSE, // Specify expected response type
          timeout: 5000, // Custom timeout
        },
      );
      setLastMessage(`Typed Response: ${JSON.stringify(response)}`);
    } catch (error) {
      setLastMessage(`Typed Error: ${error}`);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-lg max-w-sm">
      <h3 className="text-lg font-semibold mb-2">Communication Bus Demo</h3>

      <div className="mb-3 text-sm">
        <div>Status: {bus.isConnected ? '✅ Connected' : '❌ Disconnected'}</div>
        <div>Ready: {bus.isReady ? '✅ Ready' : '⏳ Waiting'}</div>
      </div>

      <div className="space-y-2">
        <button
          onClick={sendTestMessage}
          disabled={!bus.isReady}
          className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm disabled:bg-gray-400"
        >
          Send Test Message
        </button>

        <button
          onClick={requestData}
          disabled={!bus.isReady}
          className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm disabled:bg-gray-400"
        >
          Request Data
        </button>

        <button
          onClick={requestDataWithSpecificResponseType}
          disabled={!bus.isReady}
          className="w-full px-3 py-2 bg-purple-500 text-white rounded text-sm disabled:bg-gray-400"
        >
          Request Data (Typed Response)
        </button>
      </div>

      {lastMessage && <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">{lastMessage}</div>}
    </div>
  );
}

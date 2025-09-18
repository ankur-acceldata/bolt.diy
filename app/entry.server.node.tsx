import type { AppLoadContext } from '@remix-run/node';
import { createReadableStreamFromReadable } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'stream';

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(<RemixServer context={remixContext} url={request.url} />, {
      onShellReady() {
        shellRendered = true;

        const body = new PassThrough();
        responseHeaders.set('Content-Type', 'text/html');

        resolve(
          new Response(createReadableStreamFromReadable(body), {
            headers: responseHeaders,
            status: responseStatusCode,
          }),
        );
        pipe(body);
      },
      onShellError(error: unknown) {
        reject(error);
      },
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;

        if (shellRendered) {
          console.error(error);
        }
      },
    });

    setTimeout(abort, 5000);
  });
}

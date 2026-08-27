/** Netlify Edge entry: Fetch API application plus persistent Blobs storage. */
import { createNetlifyBlobStorage } from '../../server/db/netlify-blobs.js';
import { handleRequest } from '../../server/index.js';

export default function app(request, context) {
  // The authenticated storage context is request-scoped on Netlify, so the
  // adapter must be created inside the handler rather than at module import.
  const storage = createNetlifyBlobStorage(context);
  return handleRequest(request, { ip: context.ip, storage });
}


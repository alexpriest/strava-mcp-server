/**
 * Upload tools.
 *
 * Strava upload endpoint accepts multipart/form-data. Since MCP tool args are
 * JSON, we accept the file as a base64-encoded string and decode here.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatUpload } from '../utils/formatters.js';

const ALLOWED_DATA_TYPES = ['fit', 'fit.gz', 'tcx', 'tcx.gz', 'gpx', 'gpx.gz'];

export function getUploadTools() {
  return [
    {
      name: 'upload-activity',
      description:
        'Upload an activity file (FIT, TCX, or GPX, optionally gzipped). The file is provided as a base64-encoded string. Strava processes uploads asynchronously — use get-upload-status with the returned upload ID to poll completion. Requires activity:write.',
      inputSchema: {
        type: 'object',
        properties: {
          file_base64: { type: 'string', description: 'Base64-encoded file contents.' },
          filename: { type: 'string', description: 'Original filename (used as part name).' },
          data_type: {
            type: 'string',
            enum: ALLOWED_DATA_TYPES,
            description: 'Strava data type. Must match the file format.',
          },
          name: { type: 'string', description: 'Optional activity name.' },
          description: { type: 'string', description: 'Optional description.' },
          trainer: { type: 'boolean' },
          commute: { type: 'boolean' },
          external_id: { type: 'string', description: 'Optional client-supplied identifier.' },
        },
        required: ['file_base64', 'filename', 'data_type'],
      },
    },
    {
      name: 'get-upload-status',
      description:
        'Check the status of a Strava upload. Returns status (pending / ready / error) and the new activity_id once processed.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava upload ID (id_str from upload-activity).' } },
        required: ['id'],
      },
    },
  ];
}

export async function handleUploadToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'upload-activity': {
        const a = (request.params.arguments ?? {}) as {
          file_base64: string; filename: string; data_type: string;
          name?: string; description?: string; trainer?: boolean; commute?: boolean; external_id?: string;
        };
        if (!a.file_base64 || !a.filename || !a.data_type) {
          return errText('file_base64, filename, and data_type are required');
        }
        if (!ALLOWED_DATA_TYPES.includes(a.data_type)) {
          return errText(`data_type must be one of: ${ALLOWED_DATA_TYPES.join(', ')}`);
        }
        let bytes: Buffer;
        try {
          bytes = Buffer.from(a.file_base64, 'base64');
        } catch {
          return errText('file_base64 is not valid base64');
        }
        if (bytes.length === 0) return errText('decoded file is empty');

        const u = await client.uploadActivity({
          fileBytes: bytes,
          filename: a.filename,
          data_type: a.data_type,
          name: a.name,
          description: a.description,
          trainer: a.trainer ? 1 : undefined,
          commute: a.commute ? 1 : undefined,
          external_id: a.external_id,
        });
        return { content: [{ type: 'text', text: formatUpload(u) }] };
      }
      case 'get-upload-status': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const u = await client.getUploadStatus(a.id);
        return { content: [{ type: 'text', text: formatUpload(u) }] };
      }
      default:
        return null;
    }
  } catch (error) {
    return { content: [{ type: 'text', text: handleToolError(error) }], isError: true };
  }
}

function errText(msg: string) {
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}

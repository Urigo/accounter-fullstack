import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '../../../shared/tokens.js';
import type { Environment } from '../../../shared/types/index.js';
import {
  fileSchema,
  folderContentSchema,
  type DriveFileContent,
  type DriveFolderContent,
} from './types/folder-content.js';

/**
 * Wall-clock budget for a single Drive exchange (metadata lookup or download).
 *
 * `fetch` has no default timeout, so without this a Drive call that never
 * answers pins the request forever: the caller eventually gives up while the
 * server keeps the operation — and its database client — alive with nothing to
 * show for it. A bounded failure is reportable; a hang is not.
 */
export const DRIVE_FETCH_TIMEOUT_MS = 60_000;

/** `fetch` with {@link DRIVE_FETCH_TIMEOUT_MS} enforced, timeout named as such. */
async function fetchWithTimeout(url: URL, what: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(DRIVE_FETCH_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error(
        `Google Drive did not answer within ${DRIVE_FETCH_TIMEOUT_MS / 1000}s while ${what}`,
        { cause: error },
      );
    }
    throw error;
  }
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class GoogleDriveProvider {
  private apiKey: string;
  constructor(@Inject(ENVIRONMENT) private env: Environment) {
    this.apiKey = this.env.googleDrive?.driveApiKey ?? '';
  }

  private async fetchFolderContent(folderUrl: string): Promise<DriveFolderContent> {
    const mainUrl = folderUrl.split('?')[0];
    const folderId = mainUrl.split('folders/')[1];
    if (!folderId) {
      throw new Error('Invalid Google Drive URL');
    }

    const url = new URL(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${this.apiKey}`,
    );

    const res = await fetchWithTimeout(url, 'listing a shared folder').catch(err => {
      const message = `Failed fetching data from Google Drive for URL="${folderUrl}": ${err instanceof Error ? err.message : String(err)}`;
      console.error(message);
      throw new Error(message, { cause: err });
    });

    const jsonResponse = await res.json().catch(err => {
      const message = `Failed parsing response from Google Drive`;
      console.error(`${message}: ${err}`);
      throw new Error(message);
    });

    const parsedResponse = folderContentSchema.safeParse(jsonResponse);
    if (!parsedResponse.success) {
      const message = `Failed to parse response from Google Drive`;
      console.error(message, parsedResponse.error);
      throw new Error(message);
    }

    return parsedResponse.data;
  }

  private async fetchFile(fileInfo: DriveFileContent): Promise<File> {
    const fileId = fileInfo.id;
    const url = new URL(`https://drive.google.com/uc?export=download&id=${fileId}`);

    // fetch file
    const response = await fetchWithTimeout(url, `downloading "${fileInfo.name}"`).catch(err => {
      const message = `Failed fetching file from Google Drive for file="${fileInfo.name}": ${err instanceof Error ? err.message : String(err)}`;
      console.error(message);
      throw new Error(message, { cause: err });
    });

    const buffer = await response.arrayBuffer().catch(err => {
      const message = `Failed parsing file from Google Drive for file="${fileInfo.name}"`;
      console.error(`${message}: ${err}`);
      throw new Error(message);
    });

    const file = new File([buffer], fileInfo.name, { type: fileInfo.mimeType });
    return file;
  }

  private isRelevantFileType(originalMimeType: string): boolean {
    const mimeType = originalMimeType.toLowerCase();
    return mimeType === 'application/pdf' || mimeType.startsWith('image/');
  }

  /**
   * Whether a URL points at a single Google Drive *file* (as opposed to a
   * folder, which {@link fetchFilesFromSharedFolder} handles).
   */
  public static isFileUrl(rawUrl: string): boolean {
    return GoogleDriveProvider.extractFileId(rawUrl) !== null;
  }

  /**
   * Pull the file id out of the several share-link shapes Drive hands out:
   * `/file/d/<id>/view`, `/open?id=<id>`, `/uc?id=<id>`.
   */
  private static extractFileId(rawUrl: string): string | null {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== 'drive.google.com' && host !== 'docs.google.com') {
      return null;
    }
    const pathMatch = /\/(?:file|document|spreadsheets|presentation)\/d\/([^/?#]+)/.exec(
      url.pathname,
    );
    if (pathMatch) {
      return pathMatch[1];
    }
    const idParam = url.searchParams.get('id');
    return idParam && idParam.length > 0 ? idParam : null;
  }

  private async fetchFileMetadata(fileId: string): Promise<DriveFileContent> {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,kind&key=${this.apiKey}`,
    );

    const res = await fetchWithTimeout(url, `reading metadata for id="${fileId}"`).catch(err => {
      const message = `Failed fetching file metadata from Google Drive for id="${fileId}": ${err instanceof Error ? err.message : String(err)}`;
      console.error(message);
      throw new Error(message, { cause: err });
    });

    if (!res.ok) {
      // Almost always "not shared with the API key" rather than "missing".
      throw new Error(
        `Google Drive returned HTTP ${res.status} for file id="${fileId}". Make sure the file is shared with anyone holding the link.`,
      );
    }

    const parsed = fileSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      throw new Error(`Failed to parse Google Drive metadata for file id="${fileId}"`);
    }
    return parsed.data;
  }

  /**
   * Fetch a single file from a Drive share link.
   *
   * A share link is not a download link — `/file/d/<id>/view` answers with an
   * HTML page — so the id is resolved through the Drive API for its real name
   * and MIME type before the bytes are pulled.
   */
  public async fetchFileFromUrl(fileUrl: string): Promise<File> {
    const fileId = GoogleDriveProvider.extractFileId(fileUrl);
    if (!fileId) {
      throw new Error(`Not a Google Drive file URL: "${fileUrl}"`);
    }
    const metadata = await this.fetchFileMetadata(fileId);
    if (!this.isRelevantFileType(metadata.mimeType)) {
      throw new Error(
        `Unsupported Google Drive file type "${metadata.mimeType}" for file="${metadata.name}" — expected a PDF or an image`,
      );
    }
    return this.fetchFile(metadata);
  }

  public async fetchFilesFromSharedFolder(folderUrl: string): Promise<File[]> {
    try {
      const folderData = await this.fetchFolderContent(folderUrl);

      const relevantFiles = folderData.files.filter(file => this.isRelevantFileType(file.mimeType));

      if (!relevantFiles.length) {
        return [];
      }

      const files = await Promise.all(relevantFiles.map(fileInfo => this.fetchFile(fileInfo)));

      return files;
    } catch (e) {
      // Keep the reason in the message: this is the only thing the caller (and
      // the model driving an upload) sees, and "failed" alone is undiagnosable.
      const message = `Failed fetching files from Google Drive: ${e instanceof Error ? e.message : String(e)}`;
      console.error(message);
      throw new Error(message, { cause: e });
    }
  }
}

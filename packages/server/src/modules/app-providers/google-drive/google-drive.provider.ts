import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '../../../shared/types/index.js';
import {
  folderContentSchema,
  type DriveFileContent,
  type DriveFolderContent,
} from './types/folder-content.js';

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

    const res = await fetch(url).catch(err => {
      const message = `Failed fetching data from Google Drive for URL="${folderUrl}"`;
      console.error(`${message}: ${err}`);
      throw new Error(message);
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
    const response = await fetch(url).catch(err => {
      const message = `Failed fetching file from Google Drive for file="${fileInfo.name}"`;
      console.error(`${message}: ${err}`);
      throw new Error(message);
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
      const message = `Failed fetching files from Google Drive`;
      console.error(`${message}: ${e}`);
      throw new Error(message);
    }
  }
}

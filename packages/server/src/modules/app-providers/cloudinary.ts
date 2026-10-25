import { v2 as cloudinary } from 'cloudinary';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '../../shared/tokens.js';
import type { Environment } from '../../shared/types/index.js';

/** What Cloudinary stores an upload as (`auto` is only a request option, never a result) */
export type CloudinaryResourceType = 'image' | 'video' | 'raw';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CloudinaryProvider {
  constructor(@Inject(ENVIRONMENT) private env: Environment) {
    cloudinary.config({
      cloud_name: this.env.cloudinary?.name,
      api_key: this.env.cloudinary?.apiKey,
      api_secret: this.env.cloudinary?.apiSecret,
      secure: true,
    });
  }

  public async uploadInvoiceToCloudinary(
    base64string: string,
    // fileFormat?: string,
  ): Promise<{
    fileUrl: string;
    imageUrl: string;
    publicId: string;
    resourceType: CloudinaryResourceType;
  }> {
    try {
      const res = await cloudinary.uploader.upload(base64string, {
        resource_type: 'auto',
        quality: 100,
      });

      const fileUrl = res.url;

      const imageUrl = res.url.split('.').slice(0, -1).join('.') + '.jpg';

      return {
        fileUrl,
        imageUrl,
        publicId: res.public_id,
        resourceType: res.resource_type as CloudinaryResourceType,
      };
    } catch (e) {
      const message = 'Error on uploading file to cloudinary';
      console.error(`${message}: ${(e as Error).message}\n${JSON.stringify(e, null, 2)}`);
      throw new Error(message, { cause: e });
    }
  }

  /**
   * Remove an uploaded file, e.g. one whose document was never saved. `resourceType` must be the
   * one the upload returned: a delete under another type finds nothing.
   */
  public async deleteUpload(publicId: string, resourceType: CloudinaryResourceType): Promise<void> {
    try {
      // `destroy` resolves (rather than rejects) when there is nothing to delete
      const res = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      if (res?.result !== 'ok') {
        throw new Error(`Cloudinary responded "${res?.result ?? 'no result'}"`);
      }
    } catch (e) {
      const message = `Error on deleting file [${publicId}] from cloudinary`;
      console.error(`${message}: ${(e as Error).message}\n${JSON.stringify(e, null, 2)}`);
      // the SDK rejects with a plain object, not an Error
      throw new Error(message, { cause: e });
    }
  }
}

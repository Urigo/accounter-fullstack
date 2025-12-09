import { v2 as cloudinary } from 'cloudinary';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { ENVIRONMENT } from '../../shared/tokens.js';
import type { Environment } from '../../shared/types/index.js';

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
  ): Promise<{ fileUrl: string; imageUrl: string }> {
    try {
      const res = await cloudinary.uploader.upload(base64string);

      const fileUrl = res.url;

      const imageUrl = res.url.split('.').slice(0, -1).join('.') + '.jpg';

      return { fileUrl, imageUrl };
    } catch (e) {
      const message = 'Error on uploading file to cloudinary';
      console.error(`${message}: ${e}`);
      throw new Error(message);
    }
  }
}

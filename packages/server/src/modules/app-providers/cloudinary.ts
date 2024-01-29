import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';
import { Injectable, Scope } from 'graphql-modules';

config({ path: '../.env' });

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CloudinaryProvider {
  public initCloudinary() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    console.debug('Cloudinary initialized');
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
      throw new Error(
        `Error on uploading file to cloudinary: ${
          typeof e === 'string' ? e : (e as Error)?.message
        }`,
      );
    }
  }
}

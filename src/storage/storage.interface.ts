export type PresignedUpload = {
  url: string;
  fields: Record<string, string>;
};

export interface IStorageClient {
  getPresignedUploadUrl(key: string, mimeType: string, maxSizeBytes: number): Promise<PresignedUpload>;
  getObject(key: string): Promise<Buffer>;
}

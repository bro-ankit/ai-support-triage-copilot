export interface IStorageClient {
  getPresignedUploadUrl(key: string, mimeType: string): Promise<string>;
  getObject(key: string): Promise<Buffer>;
}

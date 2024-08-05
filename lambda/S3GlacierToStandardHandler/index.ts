import { S3 } from 'aws-sdk';

const s3 = new S3();

exports.handler = async (event: any) => {
  
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));


  try {
    await s3.copyObject({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: key,
      StorageClass: 'STANDARD',
    }).promise();

    console.log(`Successfully changed storage class of ${key} to STANDARD`);
  } catch (error) {
    console.error(`Error changing storage class of ${key}:`, error);
  }
};

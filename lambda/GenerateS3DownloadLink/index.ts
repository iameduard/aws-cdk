import { S3 } from 'aws-sdk';

const s3 = new S3();

export const handler = async (event: any) => {
  // Obtener el bucket y el path del archivo CSV del cuerpo de la solicitud
  const body = JSON.parse(event.body);
  let s3Path = body.s3_path;
  
  // Eliminar el prefijo 's3://' del path
  if (s3Path.startsWith('s3://')) {
    s3Path = s3Path.slice('s3://'.length);
  }

  // Extraer el nombre del bucket y la clave del archivo del path completo
  const [bucketName, ...keyParts] = s3Path.split('/');
  const key = keyParts.join('/');

  // Generar un enlace pre-firmado para descargar el archivo
  try {
    const presignedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: bucketName,
      Key: key,
      Expires: 28800, // El enlace expira en 8 horas (28800 segundos)
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: presignedUrl }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    // Verifica si 'error' tiene una propiedad 'message'
    if (error instanceof Error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'An unknown error occurred' }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }
  }
};
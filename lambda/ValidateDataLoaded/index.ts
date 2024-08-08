import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const regionName = 'us-east-2';
const outputLocation = 's3://aws-bucket-data-historica-dbfondos/athena-output-results/';

export const handler: APIGatewayProxyHandler = async (event) => {
  const athena = new AWS.Athena({ region: regionName });

  // Obtener la consulta SQL del cuerpo del evento
  const eventBody = JSON.parse(event.body || '{}');
  const tableName = eventBody.tableName || 'Hricotransa';
  const tableSchema = eventBody.tableSchema || 'dbo'; 
  const dateColumn = eventBody.dateColumn || 'FECHA';
  const year = eventBody.year || 2023;
  const month = eventBody.month || 1;
  const database = eventBody.database || 'your_database_name';  // Nombre de la base de datos de Athena

  // Construir la consulta SQL
  let sql = `SELECT `;

  sql = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = ${tableSchema} AND table_name = '${tableName}'; `;

   
  // Start Athena query execution
  const startQueryExecution = await athena.startQueryExecution({
    QueryString: sql,
    QueryExecutionContext: { Database: database },
    ResultConfiguration: { OutputLocation: outputLocation }
  }).promise();

  const queryExecutionId = startQueryExecution.QueryExecutionId;

  if (!queryExecutionId) {
    throw new Error('Failed to start query execution, no query execution ID returned.');
  }

  // Wait for the query to complete
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    const getQueryExecution = await athena.getQueryExecution({ QueryExecutionId: queryExecutionId }).promise();
    const queryExecutionStatus = getQueryExecution.QueryExecution?.Status;
    if (queryExecutionStatus) {
      status = queryExecutionStatus.State!;
      if (status === 'FAILED' || status === 'CANCELLED') {
        throw new Error(`Athena query failed or was cancelled: ${queryExecutionStatus.StateChangeReason}`);
      }
    } else {
      throw new Error('Failed to get query execution status.');
    }
    await new Promise(resolve => setTimeout(resolve, 10000)); // wait for 2 seconds
  }

  // Extracting the S3 path from the response
  const outputFilePath = `${outputLocation}${queryExecutionId}.csv`;

  // Include S3 output file path in the response body
  const responseBody = { output_location: outputFilePath };

  return {
    statusCode: 200,
    body: JSON.stringify(responseBody)
  };

};
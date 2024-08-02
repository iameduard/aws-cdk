import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

export const handler: APIGatewayProxyHandler = async (event) => {
  const regionName = 'us-east-2';
  const athena = new AWS.Athena({ region: regionName });
  
  // Obtener la consulta SQL del cuerpo del evento
  const eventBody = JSON.parse(event.body || '{}');
  
  const sql = eventBody.sql;
  const database = eventBody.database;
  
  const outputLocation = 's3://aws-bucket-data-historica-dbfondos/athena-output-results/';

  // Start Athena query execution
  const startQueryExecution = await athena.startQueryExecution({
    QueryString: sql,
    QueryExecutionContext: { Database: database },
    ResultConfiguration: { OutputLocation: outputLocation }
  }).promise();

  const queryExecutionId = startQueryExecution.QueryExecutionId;

  // Wait for the query to complete
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    const getQueryExecution = await athena.getQueryExecution({ QueryExecutionId: queryExecutionId }).promise();
    status = getQueryExecution.QueryExecution.Status.State;
    if (status === 'FAILED' || status === 'CANCELLED') {
      throw new Error(`Athena query failed or was cancelled: ${getQueryExecution.QueryExecution.Status.StateChangeReason}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for 2 seconds
  }

  // Extracting the S3 path from the response
  const outputFilePath = `s3://${outputLocation}/${queryExecutionId}.csv`;

  // Include S3 output file path in the response body
  const responseBody = { output_location: outputFilePath };

  return {
    statusCode: 200,
    body: JSON.stringify(responseBody)
  };
};

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';

// import * as sqs from 'aws-cdk-lib/aws-sqs';


const _environment = 'dev';
const _region = 'us-east2';

let _service;
let _description;


export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define environment, region and description

    _service = 'bk';
    _description = 'datahist';
    const _bucket = `${_environment}-${_region}-${_service}-${_description}`;

    // Creación de Bucket S3 donde se almacenara la data histórica

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: _bucket,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      autoDeleteObjects: true, // NOT recommended for production code

    });

    
    //Creación de la base de datos de Athena..

    _service = 'athena';
    _description = 'dbfondos';
    const _database = `${_environment}-${_region}-${_service}-${_description}`;

    // Create a Glue database which Athena uses
    const database = new glue.CfnDatabase(this, 'AthenaDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: _database
      }
    });

    //Creación de la lambda que cambia el estado de los archivos S3 dentro del Bucket.

    _service = 'lambda';
    _description = 'dbfondos';
    const _lambda = `${_environment}-${_region}-${_service}-${_description}`;

    const lambdaFunction = new lambda.Function(this, 'S3GlacierToStandardHandler', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'lambda-handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    //Grant permiso a la lambda para leer y escribir en bucket S3..
    
    bucket.grantReadWrite(lambdaFunction);


  }
}

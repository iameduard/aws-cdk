import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as events from 'aws-cdk-lib/aws-events';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import * as s3_deployment from 'aws-cdk-lib/aws-s3-deployment';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

// import * as sqs from 'aws-cdk-lib/aws-sqs';


const _environment = 'dev';
const _region = 'us-east-2';

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

    // Crear carpetas dentro del bucket S3
    new s3_deployment.BucketDeployment(this, 'DeployEmptyFolders', {
      destinationBucket: bucket,
      destinationKeyPrefix: 'athena-output-results/', 
      sources: [s3_deployment.Source.data('dummy', '')] 
    });

    new s3_deployment.BucketDeployment(this, 'DeployEmptyFolders2', {
      destinationBucket: bucket,
      destinationKeyPrefix: 'converted/', 
      sources: [s3_deployment.Source.data('dummy', '')] 
    });

    new s3_deployment.BucketDeployment(this, 'DeployEmptyFolders3', {
      destinationBucket: bucket,
      destinationKeyPrefix: 'raw/', 
      sources: [s3_deployment.Source.data('dummy', '')] 
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


    _service = 'lambda';
    _description = 'query_athena_base';
    const _lambda2 = `${_environment}-${_region}-${_service}-${_description}`; //dev-us-east-2-lambda-query_athena_base
    console.log(_lambda2)

    /*
    // define lambda function for Athena query
    const queryAthenaBaseLambda = new nodejs.NodejsFunction(this, _lambda2, {
      tracing: lambda.Tracing.ACTIVE,
      handler: 'handler',
      environment: {
        REGION_NAME: 'us-east-2',
        OUTPUT_LOCATION: `s3://${_bucket}/athena-output-results/`
      },
    });
    */

    const LambdaQueryAthenaBase = new NodejsFunction(this, "LambdaQueryAthenaBase", {
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        REGION_NAME: 'us-east-2',
        OUTPUT_LOCATION: `s3://${_bucket}/athena-output-results/`
      },
    })


    /*

    const fn = new lambda.Function(this, 'S3EventNotificationsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'S3EventNotificationsManager',
      handler: 'manage-s3-event-notifications.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      reservedConcurrentExecutions: 1,
      timeout: cdk.Duration.seconds(300)
    });

    */

    new lambda.Function(this, 'SimpleLambdaFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,  // Usa la versión de Node.js que prefieras
      functionName: 'SimpleLambdaFunction',
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/SimpleLambdaFunction')),  // Ruta al directorio que contiene el código
    });

  
    //Creación de la lambda que cambia el estado de los archivos S3 dentro del Bucket.

    _service = 'lambda';
    _description = 'changestate';
    const _lambda = `${_environment}-${_region}-${_service}-${_description}`;

    const lambdaFunction = new lambda.Function(this, 'S3GlacierToStandardHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      functionName: 'S3GlacierToStandardHandler',
      handler: 'index.handler',  //dev-us-east2-lambda-changestate
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/S3GlacierToStandardHandler')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

  /***********************************


    //Grant permiso a la lambda para leer y escribir en bucket S3..

    bucket.grantReadWrite(LambdaQueryAthenaBase);

    //Define apigateway
    const api = new apigateway.RestApi(this, "devHistRestAPI", {
      deployOptions: {
        dataTraceEnabled: true,
        tracingEnabled: true
      },
    })

    //Define POST endpoint and associate it with queryAthenaBase lambda
    const executeQueryEndpoint = api.root.addResource("query");
    const executeQueryEndpointMethod = executeQueryEndpoint.addMethod("POST", new apigateway.LambdaIntegration(LambdaQueryAthenaBase));

    */
   
  }
}

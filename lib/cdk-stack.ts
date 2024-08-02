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
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
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
    _description = 'changestate';
    const _lambda = `${_environment}-${_region}-${_service}-${_description}`;

    const lambdaFunction = new lambda.Function(this, 'S3GlacierToStandardHandler', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: `${_lambda}.handler`,  //dev-us-east2-lambda-changestate
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    _service = 'lambda';
    _description = 'query_athena_base';
    const _lambda2 = `${_environment}-${_region}-${_service}-${_description}`;

    // define lambda function for Athena query
    const queryAthenaBaseLambda = new nodejs.NodejsFunction(this, "queryAthenaBaseFunction", {
      tracing: lambda.Tracing.ACTIVE,
      entry: `${_lambda2}.ts`,  // Adjust this path to your actual file location
      handler: 'handler',
      environment: {
        REGION_NAME: 'us-east-2',
        OUTPUT_LOCATION: 's3://aws-bucket-data-historica-dbfondos/athena-output-results/'
      },
    });

    //Grant permiso a la lambda para leer y escribir en bucket S3..

    bucket.grantReadWrite(lambdaFunction);

    //Define apigateway
    const api = new apigateway.RestApi(this, "RestAPI", {
      deployOptions: {
        dataTraceEnabled: true,
        tracingEnabled: true
      },
    })

    //Define POST endpoint and associate it with queryAthenaBase lambda
    const postEndpoint = api.root.addResource("execute_query");
    postEndpoint.addMethod("POST", new apigateway.LambdaIntegration(queryAthenaBaseLambda));
  
  }
}

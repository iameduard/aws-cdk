import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, Stack, StackProps, App } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as events from 'aws-cdk-lib/aws-events';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import * as s3_deployment from 'aws-cdk-lib/aws-s3-deployment';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

interface MyCdkStackProps extends StackProps {
  stackName: 'dev' | 'prod'
  deploymentEnvironment: 'dev' | 'prod';
}

const _environment = 'dev';
const _region = 'us-east-2';
const _project = 'hist';

let _service;
let _description;
let _name;


export class CdkStack extends Stack {
  constructor(scope: cdk.App, id: string, props?: MyCdkStackProps) {
    super(scope, id, props);

    // Define environment, region and description

    _service = 's3';
    _description = 'dbfondos';
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;

    // Creación de Bucket S3 donde se almacenara la data histórica

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: _name,
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
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;

    // Create a Glue database which Athena uses
    const database = new glue.CfnDatabase(this, 'AthenaDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: _name
      }
    });


    _service = 'lbda';
    _description = 'query_athena_base';
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;
    //console.log(_lambda2)



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


    // Define the Role
    const lambdaRole = new iam.Role(this, 'LambdaQueryAthenaBaseRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // Agregando politicas al role
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:*',
        'athena:*',
        'glue:*'
      ],
      resources: ['*'] // Adjust the resources according to your specific requirements
    }));

    const LambdaQueryAthenaBase = new NodejsFunction(this, 'LambdaQueryAthenaBase', {
      functionName: _name,
      handler: 'index.handler',
      entry: path.join(__dirname, '../lambda/LambdaQueryAthenaBase/index.ts'),
      environment: {
        REGION_NAME: 'us-east-2',
        OUTPUT_LOCATION: `s3://${bucket.bucketName}/athena-output-results/`,
        BUCKET_NAME: bucket.bucketName,
      },
      timeout: cdk.Duration.seconds(300), //300 sec = 5 min
      role: lambdaRole,
    });


    //Grant permiso a la lambda para leer y escribir en bucket S3..

    bucket.grantReadWrite(LambdaQueryAthenaBase);

  
    //Creación de la lambda que cambia el estado de los archivos S3 dentro del Bucket.

    _service = 'lbda';
    _description = 's3_to_std';
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;


    const lambdaRole2 = new iam.Role(this, 'LambdaS3AccessRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    
    // Permisos para acceder y modificar objetos en S3

    lambdaRole2.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:ListBucket',
        's3:PutObject',
      ],
      resources: [
        bucket.bucketArn,
        `${bucket.bucketArn}/*`, // Permisos en los objetos dentro del bucket
      ],
    }));


    const ChangeS3ToStandard = new NodejsFunction(this, 'ChangeS3ToStandard', {
      functionName: _name,
      handler: 'index.handler',
      entry: path.join(__dirname, '../lambda/ChangeS3ToStandard/index.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      timeout: cdk.Duration.seconds(60), //60 sec = 1 min
      role: lambdaRole2,
    });

    _service = 'lbda';
    _description = 's3_dwl_link';
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;

    const GenerateS3DownloadLink = new NodejsFunction(this, 'GenerateS3DownloadLink', {
      functionName: _name,
      handler: 'index.handler',
      entry: path.join(__dirname, '../lambda/GenerateS3DownloadLink/index.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      timeout: cdk.Duration.seconds(60), //60 sec = 1 min
      role: lambdaRole2,
    });


    _service = 'lbda';
    _description = 'sqs_notif_center';
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;

    const SendMessageSQSNotification = new NodejsFunction(this, 'SendMessageSQSNotification', {
      functionName: _name,
      handler: 'index.handler',
      entry: path.join(__dirname, '../lambda/SendMessageSQSNotification/index.ts'),
      timeout: cdk.Duration.seconds(60), //60 sec = 1 min
    });


    _service = 'lbda';
    _description = 'validate_data_loaded';
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;

    const ValidateDataLoaded = new NodejsFunction(this, 'ValidateDataLoaded', {
      functionName: _name,
      handler: 'index.handler',
      entry: path.join(__dirname, '../lambda/ValidateDataLoaded/index.ts'),
      timeout: cdk.Duration.seconds(60), //60 sec = 1 min
    });


    //Define apigateway..

    _service = 'apigw';
    _description = 'rest-api';
    _name = `${_environment}-${_region}-${_project}-${_service}-${_description}`;

    const api = new apigateway.RestApi(this, "RestAPI", {
      restApiName: _name,
      deployOptions: {
        dataTraceEnabled: true,
        tracingEnabled: true
      },
    })


    //Define POST endpoint and associate it with queryAthenaBase lambda..

    const executeQueryEndpoint = api.root.addResource("query");
    const executeQueryEndpointMethod = executeQueryEndpoint.addMethod("POST", new apigateway.LambdaIntegration(LambdaQueryAthenaBase));

    const changeStateEndpoint = api.root.addResource("to_standard");
    const changeStateEndpointMethod = changeStateEndpoint.addMethod("POST", new apigateway.LambdaIntegration(ChangeS3ToStandard));

    const createLinkEndpoint = api.root.addResource("getLink");
    const createLinkEndpointMethod = createLinkEndpoint.addMethod("POST", new apigateway.LambdaIntegration(GenerateS3DownloadLink));

    const mgNotifCenterEndpoint = api.root.addResource("mgNotifCenter");
    const mgNotifCenterEndpointMethod = mgNotifCenterEndpoint.addMethod("POST", new apigateway.LambdaIntegration(SendMessageSQSNotification));

    const ValidateDataLoadedEndpoint = api.root.addResource("ValidateDataLoaded");
    const ValidateDataLoadedEndpointMethod = ValidateDataLoadedEndpoint.addMethod("POST", new apigateway.LambdaIntegration(ValidateDataLoaded));

  }
}

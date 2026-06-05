import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as path from 'path'

export interface CdkLambdaAppStackProps extends cdk.StackProps {
    table: dynamodb.ITableV2;
    tableKey: kms.IKey;
    bedrockInvokePolicy: iam.IManagedPolicy;
    bedrockModelArn: string;
}

export class CdkLambdaAppStack extends cdk.Stack {
    public readonly ticketHandler: lambdaNode.NodejsFunction;

    constructor(scope: Construct, id: string, props: CdkLambdaAppStackProps) {
        super(scope, id, props);

        const executionRole = new iam.Role(this, 'TicketHandlerRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'SwiftSupport ticket Lambda execution role',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                props.bedrockInvokePolicy
            ]
        });

        // KMS decrypt is required because the table is encrypted with a CMK
        props.tableKey.grantEncryptDecrypt(executionRole);

        this.ticketHandler = new lambdaNode.NodejsFunction(this, 'TicketHandler', {
            functionName: 'SwiftSupport-Ticket-Handler',
            entry: path.join(__dirname, '..', 'lambda', 'lambda.ts'),
            handler: 'lambda',
            runtime: lambda.Runtime.NODEJS_20_X,
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            logRetention: logs.RetentionDays.ONE_MONTH,
            tracing: lambda.Tracing.ACTIVE,
            role: executionRole,
            environment: {
                TICKET_TABLE: props.table.tableName,
                USER_INDEX: 'byUser',
                BEDROCK_MODEL_ID: props.bedrockModelArn.split('/').pop()!,
                NODE_OPTIONS: '--enable-source-maps'
            },
            bundling: {
                minify: true,
                sourceMap: true,
                target: 'node20'
            }
        });

        // Scoped DynamoDB grant — least privilege via the L2 helper
        props.table.grantReadWriteData(this.ticketHandler);

        new cdk.CfnOutput(this, 'TicketHandlerArn', { value: this.ticketHandler.functionArn });
    }
}

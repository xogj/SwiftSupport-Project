import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as kms from 'aws-cdk-lib/aws-kms'

export class dynamodbSwiftSupportStack extends cdk.Stack {
    public readonly ticketTable: dynamodb.TableV2;
    public readonly tableKey: kms.Key;
    public static readonly USER_INDEX = 'byUser';

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.tableKey = new kms.Key(this, 'SwiftSupportTableKey', {
            description: 'CMK for SwiftSupport ticket table',
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        this.ticketTable = new dynamodb.TableV2(this, 'SwiftSupportTable', {
            tableName: 'SwiftSupportTickets',
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            billing: dynamodb.Billing.onDemand(),
            encryption: dynamodb.TableEncryptionV2.customerManagedKey(this.tableKey),
            pointInTimeRecovery: true,
            deletionProtection: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            globalSecondaryIndexes: [{
                indexName: dynamodbSwiftSupportStack.USER_INDEX,
                partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
                sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
                projectionType: dynamodb.ProjectionType.ALL
            }]
        });

        new cdk.CfnOutput(this, 'TicketTableName', { value: this.ticketTable.tableName });
        new cdk.CfnOutput(this, 'TicketTableArn', { value: this.ticketTable.tableArn });
    }
}

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as aws from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

export class dynamodbSwiftSupportStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const table = new dynamodb.TableV2(this, 'SwiftSupportTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            description: 'Ticket Storage',
            billing: dynamodb.Billing.onDemand(),
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

    }
}
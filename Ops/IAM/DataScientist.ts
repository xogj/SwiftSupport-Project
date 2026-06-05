// Data Scientists: Bedrock access + read-only DynamoDB

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { buildMfaEnforcementPolicy, humanAssumablePrincipal, grantGroupAssumeRole } from './shared'

export interface DataScientistStackProps extends cdk.StackProps {
    ticketTable: dynamodb.ITableV2;
    bedrockInvokePolicy: iam.IManagedPolicy;
}

export class DataScientistStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DataScientistStackProps) {
        super(scope, id, props);

        const mfaPolicy = buildMfaEnforcementPolicy(this, 'MfaEnforcement');

        const dataScientistGroup = new iam.Group(this, 'DataScientistGroup', {
            groupName: 'SwiftSupport-DataScientists'
        });
        dataScientistGroup.attachInlinePolicy(mfaPolicy);

        const alice = new iam.User(this, 'Irene');
        const james = new iam.User(this, 'James');
        dataScientistGroup.addUser(alice);
        dataScientistGroup.addUser(james);

        const dataScientistRole = new iam.Role(this, 'DataScientistRole', {
            roleName: 'SwiftSupport-DataScientist',
            assumedBy: humanAssumablePrincipal(this.account),
            description: 'Bedrock + read-only ticket data access',
            maxSessionDuration: cdk.Duration.hours(4)
        });

        // Bedrock invocation, scoped to the SwiftSupport model
        dataScientistRole.addManagedPolicy(props.bedrockInvokePolicy);

        // Read-only DynamoDB on the ticket table
        dataScientistRole.addToPolicy(new iam.PolicyStatement({
            sid: 'ReadOnlyTickets',
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:GetItem',
                'dynamodb:BatchGetItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:DescribeTable'
            ],
            resources: [props.ticketTable.tableArn, `${props.ticketTable.tableArn}/index/*`]
        }));

        // Lambda read access — they can view AI Lambdas but not modify them
        dataScientistRole.addToPolicy(new iam.PolicyStatement({
            sid: 'ReadAiLambdas',
            effect: iam.Effect.ALLOW,
            actions: [
                'lambda:GetFunction',
                'lambda:ListFunctions',
                'lambda:InvokeFunction'
            ],
            resources: [`arn:aws:lambda:${this.region}:${this.account}:function:SwiftSupport-*`]
        }));

        grantGroupAssumeRole(dataScientistGroup, dataScientistRole, 'AssumeDataScientistRole');
    }
}

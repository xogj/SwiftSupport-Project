// Developers: Lambda, API Gateway, scoped DynamoDB, CloudWatch logs read

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { buildMfaEnforcementPolicy, humanAssumablePrincipal, grantGroupAssumeRole } from './shared'

export interface DeveloperStackProps extends cdk.StackProps {
    ticketTable: dynamodb.ITableV2;
}

export class DeveloperStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DeveloperStackProps) {
        super(scope, id, props);

        const mfaPolicy = buildMfaEnforcementPolicy(this, 'MfaEnforcement');

        const developerGroup = new iam.Group(this, 'DeveloperGroup', {
            groupName: 'SwiftSupport-Developers'
        });
        developerGroup.attachInlinePolicy(mfaPolicy);

        for (const name of ['Alice', 'Bob', 'Charlie', 'Diana', 'Eric']) {
            developerGroup.addUser(new iam.User(this, name));
        }

        const developerRole = new iam.Role(this, 'DeveloperRole', {
            roleName: 'SwiftSupport-Developer',
            assumedBy: humanAssumablePrincipal(this.account),
            description: 'Lambda + API Gateway dev + scoped Dynamo + CW logs',
            maxSessionDuration: cdk.Duration.hours(4)
        });

        // Lambda: deploy/update SwiftSupport functions only
        developerRole.addToPolicy(new iam.PolicyStatement({
            sid: 'LambdaDev',
            effect: iam.Effect.ALLOW,
            actions: [
                'lambda:GetFunction',
                'lambda:ListFunctions',
                'lambda:CreateFunction',
                'lambda:UpdateFunctionCode',
                'lambda:UpdateFunctionConfiguration',
                'lambda:PublishVersion',
                'lambda:InvokeFunction',
                'lambda:TagResource',
                'lambda:GetFunctionConfiguration'
            ],
            resources: [`arn:aws:lambda:${this.region}:${this.account}:function:SwiftSupport-*`]
        }));

        // API Gateway: configuration on REST APIs (resource-level scoping is limited
        // for apigateway, so account-wide is the practical floor here)
        developerRole.addToPolicy(new iam.PolicyStatement({
            sid: 'ApiGatewayDev',
            effect: iam.Effect.ALLOW,
            actions: [
                'apigateway:GET',
                'apigateway:POST',
                'apigateway:PUT',
                'apigateway:PATCH',
                'apigateway:DELETE'
            ],
            resources: [`arn:aws:apigateway:${this.region}::/restapis/*`]
        }));

        // DynamoDB: limited — read + write items only on the ticket table,
        // no schema changes, no destructive table operations
        developerRole.addToPolicy(new iam.PolicyStatement({
            sid: 'DynamoLimited',
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:GetItem',
                'dynamodb:BatchGetItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:DescribeTable'
            ],
            resources: [props.ticketTable.tableArn, `${props.ticketTable.tableArn}/index/*`]
        }));

        // CloudWatch logs viewing (spec requirement)
        developerRole.addToPolicy(new iam.PolicyStatement({
            sid: 'CloudWatchLogsRead',
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'logs:GetLogEvents',
                'logs:FilterLogEvents',
                'logs:StartQuery',
                'logs:GetQueryResults',
                'logs:StopQuery',
                'cloudwatch:GetMetricData',
                'cloudwatch:ListMetrics'
            ],
            resources: ['*']
        }));

        grantGroupAssumeRole(developerGroup, developerRole, 'AssumeDeveloperRole');
    }
}

// ** Has Access to Lambda, API Gateway, and DynamoDB ** 

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'

export class DeveloperStack extends cdk.Stack {
    constructor(scope: Construct, id: string, vpc: ec2.IVpc, props?: cdk.StackProps) {
        super(scope, id, props);

        const mfaPolicy = new iam.Policy(this, 'MfaEnforcement', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.DENY,
                    actions: ['*'],
                    resources: ['*'],
                    conditions: {
                        BoolIfExists: {
                            'aws:MultiFactorAuthPresent': 'false'
                        }
                    }
                })
            ]
        });

        const developerGroup = new iam.Group(this, 'DeveloperGroup');

        const alice = new iam.User(this, 'Alice');
        const bob = new iam.User(this, 'Bob');
        const charlie = new iam.User(this, 'Charlie');
        const diana = new iam.User(this, 'Diana');
        const eric = new iam.User(this, 'Eric');

        developerGroup.addUser(alice);
        developerGroup.addUser(bob);
        developerGroup.addUser(charlie);
        developerGroup.addUser(diana);
        developerGroup.addUser(eric);

        const myRole = new iam.Role(this, 'DeveloperRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });

        myRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'lambda:*',
                    'apigateway:*',
                    'dynamodb:*'
                ],
                resources: ['*']
            })
        );

        myRole.attachInlinePolicy(mfaPolicy);
    }
}

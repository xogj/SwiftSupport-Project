// Has Access to Bedrock and read-only DynamoDB access** 

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

export class DataScientistStack extends cdk.Stack {
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

        const DataScientist = new iam.Group(this, 'DataScientistGroup');

        const alice = new iam.User(this, 'Irene')
        const james = new iam.User(this, 'James')

        DataScientist.addUser(Irene);
        DataScientist.addUser(James);


        const myRole = new iam.Role(this, 'DataScientist', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')

        });

        myRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'bedrock:InvokeModel',
                    'bedrock:Retrieve',
                    'bedrock:RetrieveAndGenerate'
                ],
                resources: ['*']
            })
            
            myRole.addToPrinciplePolicy(
                new iam.Policystatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'dynamodb:readonly'

                    ]
                    resources: [dynamodb.Table.fromTableName(this, 'DynamodbSwiftSuppot')]
                })
            )
        );
    }

}
}
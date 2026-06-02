// ** Has Access to all Resources ** 

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'

export class DevOpsStackSwiftSupport extends cdk.Stack {
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

        const devOpsGroup = new iam.Group(this, 'DevOpsGroup');

        const frank = new iam.User(this, 'Frank')
        const grace = new iam.User(this, 'Grace');

        devOpsGroup.addUser(frank);
        devOpsGroup.addUser(grace);


        const devOpsRole = new iam.Role(this, 'DevOpsRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            roleName: 'FullAccessAdmins'
        });

        devOpsRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
        devOpsRole.attachInlinePolicy(mfaPolicy);
    }
}
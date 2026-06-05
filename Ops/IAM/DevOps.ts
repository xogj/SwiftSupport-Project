// DevOps: full infrastructure management

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import { buildMfaEnforcementPolicy, humanAssumablePrincipal, grantGroupAssumeRole } from './shared'

export class DevOpsStackSwiftSupport extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const mfaPolicy = buildMfaEnforcementPolicy(this, 'MfaEnforcement');

        const devOpsGroup = new iam.Group(this, 'DevOpsGroup', { groupName: 'SwiftSupport-DevOps' });
        devOpsGroup.attachInlinePolicy(mfaPolicy);

        const frank = new iam.User(this, 'Frank');
        const grace = new iam.User(this, 'Grace');
        devOpsGroup.addUser(frank);
        devOpsGroup.addUser(grace);

        // Permissions boundary keeps even AdministratorAccess from creating
        // users that escalate outside of our IAM contract.
        const adminBoundary = new iam.ManagedPolicy(this, 'DevOpsBoundary', {
            description: 'Hard ceiling on what a DevOps-created principal can do',
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['*'],
                    resources: ['*']
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.DENY,
                    actions: [
                        'organizations:LeaveOrganization',
                        'account:*',
                        'aws-portal:*Billing'
                    ],
                    resources: ['*']
                })
            ]
        });

        const devOpsRole = new iam.Role(this, 'DevOpsRole', {
            roleName: 'SwiftSupport-DevOps',
            assumedBy: humanAssumablePrincipal(this.account),
            description: 'Full infrastructure management for SwiftSupport',
            maxSessionDuration: cdk.Duration.hours(4),
            permissionsBoundary: adminBoundary
        });

        devOpsRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

        grantGroupAssumeRole(devOpsGroup, devOpsRole, 'AssumeDevOpsRole');
    }
}

// Product Managers: read-only monitoring + cost data

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import { buildMfaEnforcementPolicy, humanAssumablePrincipal, grantGroupAssumeRole } from './shared'

export class ProjectManagerSwiftSupportStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const mfaPolicy = buildMfaEnforcementPolicy(this, 'MfaEnforcement');

        const projectManagerGroup = new iam.Group(this, 'ProjectManagerGroup', {
            groupName: 'SwiftSupport-ProductManagers'
        });
        projectManagerGroup.attachInlinePolicy(mfaPolicy);

        const karen = new iam.User(this, 'Karen');
        const leo = new iam.User(this, 'Leo');
        projectManagerGroup.addUser(karen);
        projectManagerGroup.addUser(leo);

        const pmRole = new iam.Role(this, 'ProjectManagerRole', {
            roleName: 'SwiftSupport-ProductManager',
            assumedBy: humanAssumablePrincipal(this.account),
            description: 'Read-only monitoring and billing visibility',
            maxSessionDuration: cdk.Duration.hours(4)
        });

        pmRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
        pmRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSBillingReadOnlyAccess'));

        // Cost Explorer + Budgets — separate API not covered by ReadOnlyAccess
        pmRole.addToPolicy(new iam.PolicyStatement({
            sid: 'CostExplorerRead',
            effect: iam.Effect.ALLOW,
            actions: [
                'ce:GetCostAndUsage',
                'ce:GetCostForecast',
                'ce:GetReservationUtilization',
                'ce:GetDimensionValues',
                'ce:GetTags',
                'budgets:ViewBudget',
                'budgets:DescribeBudgetAction'
            ],
            resources: ['*']
        }));

        grantGroupAssumeRole(projectManagerGroup, pmRole, 'AssumeProjectManagerRole');
    }
}

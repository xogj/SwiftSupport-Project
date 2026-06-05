// Security Specialist: WAF, IAM, CloudWatch

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import { buildMfaEnforcementPolicy, humanAssumablePrincipal, grantGroupAssumeRole } from './shared'

export class SecurityPersonnelStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const mfaPolicy = buildMfaEnforcementPolicy(this, 'MfaEnforcement');

        const securityGroup = new iam.Group(this, 'SecurityPersonnelGroup', {
            groupName: 'SwiftSupport-Security'
        });
        securityGroup.attachInlinePolicy(mfaPolicy);

        // Spec requires 1 security specialist — Henry
        const henry = new iam.User(this, 'Henry');
        securityGroup.addUser(henry);

        const securityRole = new iam.Role(this, 'SecurityPersonnelRole', {
            roleName: 'SwiftSupport-Security',
            assumedBy: humanAssumablePrincipal(this.account),
            description: 'WAF + IAM + CloudWatch security operations',
            maxSessionDuration: cdk.Duration.hours(4)
        });

        // WAF management
        securityRole.addToPolicy(new iam.PolicyStatement({
            sid: 'WAFAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'wafv2:ListWebACLs',
                'wafv2:GetWebACL',
                'wafv2:CreateWebACL',
                'wafv2:UpdateWebACL',
                'wafv2:DeleteWebACL',
                'wafv2:ListRuleGroups',
                'wafv2:GetRuleGroup',
                'wafv2:CreateRuleGroup',
                'wafv2:UpdateRuleGroup',
                'wafv2:DeleteRuleGroup',
                'wafv2:GetSampledRequests',
                'wafv2:ListTagsForResource',
                'wafv2:AssociateWebACL',
                'wafv2:DisassociateWebACL'
            ],
            resources: ['*']
        }));

        // IAM administration
        securityRole.addToPolicy(new iam.PolicyStatement({
            sid: 'IAMAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'iam:Get*',
                'iam:List*',
                'iam:GenerateCredentialReport',
                'iam:GetCredentialReport',
                'iam:GenerateServiceLastAccessedDetails',
                'iam:GetServiceLastAccessedDetails',
                'iam:SimulatePrincipalPolicy',
                'iam:SimulateCustomPolicy',
                'iam:CreatePolicy',
                'iam:CreatePolicyVersion',
                'iam:DeletePolicyVersion',
                'iam:AttachRolePolicy',
                'iam:DetachRolePolicy',
                'iam:PutRolePolicy',
                'iam:DeleteRolePolicy',
                'iam:UpdateAssumeRolePolicy',
                'iam:TagRole',
                'iam:UntagRole'
            ],
            resources: ['*']
        }));

        // CloudWatch logs and alarms
        securityRole.addToPolicy(new iam.PolicyStatement({
            sid: 'CloudWatchAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudwatch:*',
                'logs:*'
            ],
            resources: ['*']
        }));

        // Security audit: read everything for visibility
        securityRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('SecurityAudit')
        );

        grantGroupAssumeRole(securityGroup, securityRole, 'AssumeSecurityRole');
    }
}

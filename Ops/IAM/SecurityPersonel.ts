import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'

export class SecurityPersonnelStack extends cdk.Stack {
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

        const securityGroup = new iam.Group(this, 'SecurityPersonnelGroup', {
            groupName: 'SecurityPersonnel'
        });

        securityGroup.attachInlinePolicy(mfaPolicy);

        const securityRole = new iam.Role(this, 'SecurityPersonnelRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });

        // WAF: read/write access to inspect and manage web ACLs and rules
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

        // IAM: read access plus ability to manage roles/policies for security reviews
        securityRole.addToPolicy(new iam.PolicyStatement({
            sid: 'IAMAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'iam:GetRole',
                'iam:ListRoles',
                'iam:GetPolicy',
                'iam:ListPolicies',
                'iam:GetPolicyVersion',
                'iam:ListPolicyVersions',
                'iam:GetRolePolicy',
                'iam:ListRolePolicies',
                'iam:ListAttachedRolePolicies',
                'iam:GetUser',
                'iam:ListUsers',
                'iam:GetGroup',
                'iam:ListGroups',
                'iam:ListGroupsForUser',
                'iam:GetUserPolicy',
                'iam:ListUserPolicies',
                'iam:ListAttachedUserPolicies',
                'iam:GenerateCredentialReport',
                'iam:GetCredentialReport',
                'iam:GenerateServiceLastAccessedDetails',
                'iam:GetServiceLastAccessedDetails',
                'iam:SimulatePrincipalPolicy'
            ],
            resources: ['*']
        }));

        // CloudWatch: read/write access for security monitoring and alerting
        securityRole.addToPolicy(new iam.PolicyStatement({
            sid: 'CloudWatchAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudwatch:GetMetricData',
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                'cloudwatch:DescribeAlarms',
                'cloudwatch:PutMetricAlarm',
                'cloudwatch:DeleteAlarms',
                'cloudwatch:EnableAlarmActions',
                'cloudwatch:DisableAlarmActions',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'logs:GetLogEvents',
                'logs:FilterLogEvents',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:PutMetricFilter',
                'logs:DeleteMetricFilter',
                'logs:DescribeMetricFilters',
                'logs:StartQuery',
                'logs:GetQueryResults',
                'logs:StopQuery'
            ],
            resources: ['*']
        }));
    }
}

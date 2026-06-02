//**Read only access for monitoring and cost data — WAF, IAM, and CloudWatch access**

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'

export class ProjectManagerSwiftSupportStack extends cdk.Stack {
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

        const projectManagerGroup = new iam.Group(this, 'ProjectManagerGroup');

        const karen = new iam.User(this, 'Karen');
        const leo = new iam.User(this, 'Leo');

        projectManagerGroup.addUser(karen);
        projectManagerGroup.addUser(leo);

        const myRole = new iam.Role(this, 'ProjectManagerRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });

        myRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
        myRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSBillingReadOnlyAccess'));

        const wafPolicy = new iam.Policy(this, 'WafReadOnly', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'wafv2:GetWebACL',
                        'wafv2:ListWebACLs',
                        'wafv2:GetRule',
                        'wafv2:ListRules',
                        'wafv2:GetSampledRequests',
                        'waf-regional:GetWebACL',
                        'waf-regional:ListWebACLs'
                    ],
                    resources: ['*']
                })
            ]
        });

        const iamReadPolicy = new iam.Policy(this, 'IamReadOnly', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'iam:GetUser',
                        'iam:ListUsers',
                        'iam:GetGroup',
                        'iam:ListGroups',
                        'iam:GetRole',
                        'iam:ListRoles',
                        'iam:GetPolicy',
                        'iam:ListPolicies',
                        'iam:ListAttachedRolePolicies',
                        'iam:ListAttachedUserPolicies',
                        'iam:ListAttachedGroupPolicies',
                        'iam:GetAccountSummary',
                        'iam:GenerateCredentialReport',
                        'iam:GetCredentialReport'
                    ],
                    resources: ['*']
                })
            ]
        });

        const cloudWatchPolicy = new iam.Policy(this, 'CloudWatchReadOnly', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'cloudwatch:GetMetricData',
                        'cloudwatch:GetMetricStatistics',
                        'cloudwatch:ListMetrics',
                        'cloudwatch:DescribeAlarms',
                        'cloudwatch:DescribeAlarmHistory',
                        'logs:DescribeLogGroups',
                        'logs:DescribeLogStreams',
                        'logs:GetLogEvents',
                        'logs:FilterLogEvents'
                    ],
                    resources: ['*']
                })
            ]
        });

        myRole.attachInlinePolicy(mfaPolicy);
        myRole.attachInlinePolicy(wafPolicy);
        myRole.attachInlinePolicy(iamReadPolicy);
        myRole.attachInlinePolicy(cloudWatchPolicy);
    }
}
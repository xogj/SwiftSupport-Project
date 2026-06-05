import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'

export interface SwiftSupportWafStackProps extends cdk.StackProps {
    scope: 'REGIONAL' | 'CLOUDFRONT';
    name: string;
}

export class SwiftSupportWafStack extends cdk.Stack {
    public readonly webAcl: wafv2.CfnWebACL;
    public readonly webAclArn: string;

    constructor(scope: Construct, id: string, props: SwiftSupportWafStackProps) {
        super(scope, id, props);

        const rules: wafv2.CfnWebACL.RuleProperty[] = [
            {
                name: 'AWS-AWSManagedRulesCommonRuleSet',
                priority: 1,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        vendorName: 'AWS',
                        name: 'AWSManagedRulesCommonRuleSet'
                    }
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: 'CommonRuleSet',
                    sampledRequestsEnabled: true
                }
            },
            {
                name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
                priority: 2,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        vendorName: 'AWS',
                        name: 'AWSManagedRulesKnownBadInputsRuleSet'
                    }
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: 'KnownBadInputs',
                    sampledRequestsEnabled: true
                }
            },
            {
                name: 'AWS-AWSManagedRulesAmazonIpReputationList',
                priority: 3,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        vendorName: 'AWS',
                        name: 'AWSManagedRulesAmazonIpReputationList'
                    }
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: 'IpReputation',
                    sampledRequestsEnabled: true
                }
            },
            {
                name: 'RateLimitPerIp',
                priority: 10,
                action: { block: {} },
                statement: {
                    rateBasedStatement: {
                        limit: 2000,
                        aggregateKeyType: 'IP'
                    }
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: 'RateLimitPerIp',
                    sampledRequestsEnabled: true
                }
            }
        ];

        this.webAcl = new wafv2.CfnWebACL(this, 'SwiftSupportAcl', {
            defaultAction: { allow: {} },
            scope: props.scope,
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: `${props.name}-Metric`,
                sampledRequestsEnabled: true
            },
            name: props.name,
            rules
        });

        this.webAclArn = this.webAcl.attrArn;

        new cdk.CfnOutput(this, 'WebAclArn', { value: this.webAclArn });
    }
}

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'

export class SwiftSupportWafStack extends cdk.Stack {
    public readonly webAcl: wafv2.CfnWebACL;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.webAcl = new wafv2.CfnWebACL(this, 'SwiftSupportAcl', {
            defaultAction: { allow: {} },
            scope: 'REGIONAL',
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'MywebAclMetric',
                sampledRequestsEnabled: true
            },
            name: 'SwiftSupport-WAF',
            rules: [
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
                        metricName: 'AWS-CommonRuleSet',
                        sampledRequestsEnabled: true
                    }
                }
            ]
        })
    }
}
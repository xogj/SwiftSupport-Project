import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'

export class Route53SwiftSupportStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const myZone = new route53.PublicHostedZone(this, 'SwiftSupport', {
            zoneName: 'SwiftSupport.com'
        });

        const bucket = new s3.Bucket(this, 'SwiftSupportBucket', {
            bucketName: 'swiftsupportbucket',
            websiteIndexDocument: 'SwiftSupport.html',
            publicReadAccess: true
        });

        const zone = route53.HostedZone.fromLookup(this, 'Zone', {
            domainName: 'SwiftSupport.com'
        });

        new route53.ARecord(this, 'SwiftSupportRecord', {
            zone,
            target: route53.RecordTarget.fromAlias(new targets.BucketWebsiteTarget(bucket))
        });

        const healthCheck = new route53.CfnHealthCheck(this, 'SwiftSupportHealthCheck', {
            healthCheckConfig: {
                type: 'HTTP',
                fullyQualifiedDomainName: 'SwiftSupport.com'
            }
        });

        new cloudwatch.Alarm(this, 'HealthAlarm', {
            metric: new cloudwatch.Metric({
                namespace: 'AWS/Route53',
                metricName: 'HealthCheckStatus',
                dimensionsMap: {
                    HealthCheckId: healthCheck.attrHealthCheckId
                }
            }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD
        });
    }
}

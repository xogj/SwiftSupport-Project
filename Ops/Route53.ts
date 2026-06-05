import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as cwactions from 'aws-cdk-lib/aws-cloudwatch-actions'

export interface Route53SwiftSupportStackProps extends cdk.StackProps {
    distribution: cloudfront.IDistribution;
    zoneName?: string;
    alarmTopic?: sns.ITopic;
}

export class Route53SwiftSupportStack extends cdk.Stack {
    public readonly hostedZone: route53.IHostedZone;

    constructor(scope: Construct, id: string, props: Route53SwiftSupportStackProps) {
        super(scope, id, props);

        const zoneName = props.zoneName ?? 'swiftsupport.com';

        this.hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName });

        new route53.ARecord(this, 'SwiftSupportApex', {
            zone: this.hostedZone,
            recordName: zoneName,
            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(props.distribution))
        });

        new route53.ARecord(this, 'SwiftSupportWww', {
            zone: this.hostedZone,
            recordName: `www.${zoneName}`,
            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(props.distribution))
        });

        const healthCheck = new route53.CfnHealthCheck(this, 'SwiftSupportHealthCheck', {
            healthCheckConfig: {
                type: 'HTTPS',
                fullyQualifiedDomainName: zoneName,
                resourcePath: '/',
                requestInterval: 30,
                failureThreshold: 3
            }
        });

        const healthAlarm = new cloudwatch.Alarm(this, 'HealthAlarm', {
            alarmName: 'SwiftSupport-Site-HealthCheck',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/Route53',
                metricName: 'HealthCheckStatus',
                dimensionsMap: { HealthCheckId: healthCheck.attrHealthCheckId },
                statistic: 'Minimum',
                period: cdk.Duration.minutes(1)
            }),
            threshold: 1,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.BREACHING
        });

        if (props.alarmTopic) {
            healthAlarm.addAlarmAction(new cwactions.SnsAction(props.alarmTopic));
        }
    }
}

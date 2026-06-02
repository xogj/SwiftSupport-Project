import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchactions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as lambda from 'aws-cdk-lib/aws-lambda'

export class SwiftSupportCloudwatch extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)


        const SwiftSupportSNSLambda = new lambda.Function(this, 'SwiftSupportSNS', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline('exports.handler = async () => "SwiftSupport";')
        })

        const lambdaErrorMetric = SwiftSupportSNSLambda.metricErrors({
            period: cdk.Duration.minutes(5),
            statistic: 'sum',
            label: 'Swift Support Error'
        })
        const custommetrics = new cloudwatch.Metric({
            metricName: 'SwiftSupport',
            namespace: 'custom/SwiftSupport',
            dimensionsMap: {
                environment: 'Production'
            }
        })

        const errorAlarm = new cloudwatch.Alarm(this, 'SwiftSupportErrorSNS', {
            alarmName: 'Lambda-Production-Error-Alarm',
            metric: lambdaErrorMetric,
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            actionsEnabled: true
        })

        const alarmTopic = new sns.Topic(this, 'SwiftSupportAlarmTopic', {
            displayName: 'SwiftSupport Alarm Notifications'
        })

        errorAlarm.addAlarmAction(new cloudwatchactions.SnsAction(alarmTopic))

    }
}